import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const memStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const baseDoc = () => ({ version: 1, meta: { stages: ['next','doing','waiting','parked','done'], domains: [], categoryMap: {}, updatedAt: null }, projects: [], tasks: [{ id: 'b_1', title: 'one', stage: 'next' }] });

// Scripted fake fetch: each call pops the next response and records the request.
function fakeFetch(script) {
  const calls = [];
  const fn = async (url, opt = {}) => {
    calls.push({ url: String(url), method: opt.method || 'GET', body: opt.body ? JSON.parse(opt.body) : null });
    const next = script.shift();
    if (!next) throw new Error('fakeFetch: no scripted response for ' + url);
    return { ok: next.status < 400, status: next.status, json: async () => next.json ?? {} };
  };
  fn.calls = calls;
  return fn;
}
const contentsOk = (doc, sha = 'sha1') => ({ status: 200, json: { sha, encoding: 'base64', content: b64(JSON.stringify(doc)) } });
const putOk = sha => ({ status: 200, json: { content: { sha } } });

function mk(script, extra = {}) {
  const storage = memStorage(); storage.setItem('oq_gh_token', 'tok');
  const changes = [];
  const store = createStore({ fetchImpl: fakeFetch(script), storage, onChange: s => changes.push(s.status), debounceMs: 0, ...extra });
  return { store, changes, storage };
}

test('load decodes base64 content and keeps the sha', async () => {
  const { store } = mk([contentsOk(baseDoc())]);
  await store.load();
  assert.equal(store.doc.tasks[0].id, 'b_1');
  assert.equal(store.sha, 'sha1');
  assert.equal(store.status, 'idle');
});

test('load on 404 yields an empty document; first flush PUTs without a sha', async () => {
  const { store } = mk([{ status: 404 }, putOk('sha2')]);
  await store.load();
  assert.deepEqual(store.doc.tasks, []);
  assert.deepEqual(store.doc.meta.stages, ['next','doing','waiting','parked','done']);
  store.mutate(d => d.tasks.push({ id: 'b_2' }), 'add');
  await store.flush();
  const put = store.fetchImpl.calls[1];
  assert.equal(put.method, 'PUT');
  assert.equal(put.body.sha, undefined);
  assert.equal(put.body.branch, 'main');
  assert.match(put.body.message, /^live-board: /);
  assert.equal(store.sha, 'sha2');
});

test('load falls back to the blob API when encoding is not base64, and throws on empty', async () => {
  const { store } = mk([
    { status: 200, json: { sha: 'big', encoding: 'none', content: '' } },
    { status: 200, json: { content: b64(JSON.stringify(baseDoc())) } },
  ]);
  await store.load();
  assert.equal(store.doc.tasks.length, 1);
  assert.match(store.fetchImpl.calls[1].url, /git\/blobs\/big$/);

  const { store: s2 } = mk([
    { status: 200, json: { sha: 'big', encoding: 'none', content: '' } },
    { status: 200, json: { content: b64('   ') } },
  ]);
  await assert.rejects(() => s2.load(), /came back empty/);
});

test('401 sets notoken and throws AUTH', async () => {
  const { store } = mk([{ status: 401 }]);
  await assert.rejects(() => store.load(), /AUTH/);
  assert.equal(store.status, 'notoken');
});

test('mutate applies immediately, marks unsaved; flush PUTs the whole doc with the sha', async () => {
  const { store, changes } = mk([contentsOk(baseDoc(), 'shaA'), putOk('shaB')]);
  await store.load();
  const r = store.mutate(d => { d.tasks[0].title = 'edited'; return 42; }, 'edit');
  assert.equal(r, 42);
  assert.equal(store.doc.tasks[0].title, 'edited');
  assert.equal(store.status, 'unsaved');
  await store.flush();
  assert.equal(store.status, 'idle');
  const put = store.fetchImpl.calls[1];
  assert.equal(put.body.sha, 'shaA');
  const sent = JSON.parse(Buffer.from(put.body.content, 'base64').toString('utf8'));
  assert.equal(sent.tasks[0].title, 'edited');
  assert.ok(sent.meta.updatedAt);
  assert.ok(changes.includes('saving'));
});

test('conflict: re-reads, replays pending ops on the fresh doc, PUTs again', async () => {
  const remote = baseDoc(); remote.tasks.push({ id: 'b_remote', title: 'added elsewhere', stage: 'next' });
  const { store } = mk([
    contentsOk(baseDoc(), 'shaA'),
    { status: 409 },
    contentsOk(remote, 'shaR'),
    putOk('shaC'),
  ]);
  await store.load();
  store.mutate(d => { d.tasks[0].title = 'mine'; }, 'edit');
  await store.flush();
  assert.equal(store.status, 'idle');
  assert.equal(store.doc.tasks.length, 2);                   // remote change kept
  assert.equal(store.doc.tasks[0].title, 'mine');            // my op replayed
  assert.equal(store.fetchImpl.calls[3].body.sha, 'shaR');
  assert.equal(store.sha, 'shaC');
});

test('two conflicts in a row: status error, ops retained, doc unchanged', async () => {
  const { store } = mk([
    contentsOk(baseDoc(), 'shaA'),
    { status: 409 },
    contentsOk(baseDoc(), 'shaR'),
    { status: 409 },
  ]);
  await store.load();
  store.mutate(d => { d.tasks[0].title = 'mine'; }, 'edit');
  await store.flush();
  assert.equal(store.status, 'error');
  assert.equal(store.doc.tasks[0].title, 'mine');
  assert.equal(store.pendingCount(), 1);
});

test('mutations made during a flush are flushed afterwards with the new sha', async () => {
  const { store } = mk([contentsOk(baseDoc(), 'shaA'), putOk('shaB'), putOk('shaC')]);
  await store.load();
  store.mutate(d => { d.tasks[0].title = 'first'; }, 'a');
  const p = store.flush();
  store.mutate(d => { d.tasks[0].title = 'second'; }, 'b');
  await p;
  await store.flush();
  const puts = store.fetchImpl.calls.filter(x => x.method === 'PUT');
  assert.equal(puts.length, 2);
  assert.equal(puts[1].body.sha, 'shaB');
  assert.equal(store.status, 'idle');
});

test('refreshIfStale reloads only when the remote sha moved and nothing is pending', async () => {
  const moved = baseDoc(); moved.tasks[0].title = 'remote edit';
  const { store } = mk([
    contentsOk(baseDoc(), 'shaA'),
    { status: 200, json: { sha: 'shaA' } },           // unchanged → no reload
    { status: 200, json: { sha: 'shaZ' } },           // moved → reload
    contentsOk(moved, 'shaZ'),
  ]);
  await store.load();
  await store.refreshIfStale();
  assert.equal(store.doc.tasks[0].title, 'one');
  await store.refreshIfStale();
  assert.equal(store.doc.tasks[0].title, 'remote edit');
  assert.equal(store.sha, 'shaZ');
});

test('fixture mode never fetches', async () => {
  const f = fakeFetch([]);
  const store = createStore({ fetchImpl: f, fixture: baseDoc(), storage: memStorage(), onChange: () => {}, debounceMs: 0 });
  await store.load();
  store.mutate(d => d.tasks.push({ id: 'x' }), 'add');
  await store.flush();
  await store.refreshIfStale();
  assert.equal(f.calls.length, 0);
  assert.equal(store.status, 'fixture');
  assert.equal(store.doc.tasks.length, 2);
});

test('token helpers use the shared key', () => {
  const { store, storage } = mk([]);
  assert.equal(store.hasToken(), true);
  store.forgetToken();
  assert.equal(storage.getItem('oq_gh_token'), null);
  assert.equal(store.hasToken(), false);
  store.setToken('  new  ');
  assert.equal(storage.getItem('oq_gh_token'), 'new');
});
