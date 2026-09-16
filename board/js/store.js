// GitHub-backed document store for the Board Tracker. See spec §5.1.
// Same private repo, token key and 1 MiB guards as /oq/ and /ar/.
import { STAGES, DOMAINS } from './model.js';

const OWNER = 'nesks-ai', REPO = 'llm-wiki', BRANCH = 'main';
const DEFAULT_PATH = 'board/board.json';
const TOKEN_KEY = 'oq_gh_token';
const PUT_LIMIT = 900000;

const hasBuffer = typeof Buffer !== 'undefined';
const b64d = s => hasBuffer
  ? Buffer.from(s.replace(/\s/g, ''), 'base64').toString('utf8')
  : decodeURIComponent(escape(atob(s.replace(/\s/g, ''))));
const b64e = s => hasBuffer
  ? Buffer.from(s, 'utf8').toString('base64')
  : btoa(unescape(encodeURIComponent(s)));

export function emptyDoc() {
  return { version: 1, meta: { stages: [...STAGES], domains: [...DOMAINS], categoryMap: {}, updatedAt: null }, projects: [], tasks: [] };
}

export function createStore({ fetchImpl, fixture = null, onChange = () => {}, storage, path = DEFAULT_PATH, debounceMs = 2000 } = {}) {
  const fetchFn = fetchImpl || ((...a) => globalThis.fetch(...a));
  const ls = storage || globalThis.localStorage;
  const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const GH = `https://api.github.com/repos/${OWNER}/${REPO}`;

  let pending = [];          // [{fn,label}] applied locally, not yet sent
  let inflight = null;       // ops in the PUT that is running
  let timer = null;
  let flushing = null;       // Promise while a flush runs

  const store = {
    doc: null, sha: null, status: 'loading', lastSaved: null, error: null, fetchImpl: fetchFn,
    hasToken: () => !!(ls.getItem(TOKEN_KEY) || ''),
    setToken: t => { ls.setItem(TOKEN_KEY, String(t).trim()); emit(); },
    forgetToken: () => { ls.removeItem(TOKEN_KEY); emit(); },
    pendingCount: () => pending.length + (inflight ? inflight.length : 0),
  };
  const emit = () => onChange(store);
  const set = patch => { Object.assign(store, patch); emit(); };
  const heads = () => ({ Authorization: 'Bearer ' + (ls.getItem(TOKEN_KEY) || ''), Accept: 'application/vnd.github+json' });

  async function readRemote() {
    const r = await fetchFn(API + '?ref=' + BRANCH, { headers: heads(), cache: 'no-store' });
    if (r.status === 401 || r.status === 403) { set({ status: 'notoken' }); throw new Error('AUTH'); }
    if (r.status === 404) return { doc: emptyDoc(), sha: null };
    if (!r.ok) throw new Error('GitHub ' + r.status);
    const j = await r.json();
    let content = '';
    if (j.content && j.encoding === 'base64') content = b64d(j.content);
    else {
      // Above 1 MiB the contents API returns content:"" + encoding:"none". Read the blob.
      const b = await fetchFn(`${GH}/git/blobs/${j.sha}`, { headers: heads(), cache: 'no-store' });
      if (!b.ok) throw new Error('Blob read ' + b.status);
      const bj = await b.json();
      content = bj.content ? b64d(bj.content) : '';
    }
    if (!content.trim()) throw new Error('Board came back empty — not rendering');
    return { doc: JSON.parse(content), sha: j.sha };
  }

  async function putRemote(doc, sha, label) {
    doc.meta.updatedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const payload = JSON.stringify(doc, null, 2);
    const message = 'live-board: ' + label;
    if (payload.length > PUT_LIMIT) return putGitData(payload, message);
    const body = { message, content: b64e(payload), branch: BRANCH };
    if (sha) body.sha = sha;
    const r = await fetchFn(API, { method: 'PUT', headers: heads(), body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) return null;            // conflict → caller retries
    if (r.status === 401 || r.status === 403) { set({ status: 'notoken' }); throw new Error('AUTH'); }
    if (!r.ok) throw new Error('GitHub write ' + r.status);
    return (await r.json()).content.sha;
  }

  // blob -> tree -> commit -> fast-forward ref. base_tree keeps every other file;
  // force:false makes a moved branch fail as a conflict rather than clobber it.
  async function putGitData(payload, message) {
    const H = heads(), J = Object.assign({ 'Content-Type': 'application/json' }, H);
    const step = async (url, opt, label) => {
      const r = await fetchFn(url, opt);
      if (r.status === 401 || r.status === 403) { set({ status: 'notoken' }); throw new Error('AUTH'); }
      if (!r.ok) throw new Error(label + ' ' + r.status);
      return r.json();
    };
    const ref = await step(`${GH}/git/ref/heads/${BRANCH}`, { headers: H, cache: 'no-store' }, 'ref read');
    const head = ref.object.sha;
    const headCommit = await step(`${GH}/git/commits/${head}`, { headers: H, cache: 'no-store' }, 'commit read');
    const blob = await step(`${GH}/git/blobs`, { method: 'POST', headers: J, body: JSON.stringify({ content: b64e(payload), encoding: 'base64' }) }, 'blob write');
    const tree = await step(`${GH}/git/trees`, { method: 'POST', headers: J, body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }] }) }, 'tree write');
    const cm = await step(`${GH}/git/commits`, { method: 'POST', headers: J, body: JSON.stringify({ message, tree: tree.sha, parents: [head] }) }, 'commit write');
    const upd = await fetchFn(`${GH}/git/refs/heads/${BRANCH}`, { method: 'PATCH', headers: J, body: JSON.stringify({ sha: cm.sha, force: false }) });
    if (upd.status === 422) return null;
    if (!upd.ok) throw new Error('ref update ' + upd.status);
    return blob.sha;
  }

  store.load = async () => {
    if (fixture) { store.doc = JSON.parse(JSON.stringify(fixture)); set({ status: 'fixture' }); return; }
    set({ status: 'loading' });
    const { doc, sha } = await readRemote();
    store.doc = doc; store.sha = sha;
    set({ status: 'idle', error: null });
  };

  store.mutate = (fn, label = 'edit') => {
    const result = fn(store.doc);
    if (fixture) { emit(); return result; }
    pending.push({ fn, label });
    set({ status: 'unsaved' });
    clearTimeout(timer);
    timer = setTimeout(() => { store.flush(); }, debounceMs);
    return result;
  };

  store.flush = async () => {
    if (fixture) return;
    if (flushing) await flushing;
    if (!pending.length) return;
    clearTimeout(timer);
    flushing = (async () => {
      inflight = pending; pending = [];
      set({ status: 'saving' });
      const label = inflight.length === 1 ? inflight[0].label : `${inflight.length} changes`;
      try {
        let sha = await putRemote(store.doc, store.sha, label);
        if (sha === null) {
          const fresh = await readRemote();
          const replay = [...inflight, ...pending];
          for (const op of replay) op.fn(fresh.doc);
          store.doc = fresh.doc; store.sha = fresh.sha;
          inflight = replay; pending = [];
          emit();
          sha = await putRemote(store.doc, store.sha, label);
          if (sha === null) throw new Error('CONFLICT');
        }
        store.sha = sha; inflight = null;
        set({ status: pending.length ? 'unsaved' : 'idle', lastSaved: Date.now(), error: null });
      } catch (e) {
        pending = [...(inflight || []), ...pending]; inflight = null;
        if (store.status !== 'notoken') set({ status: 'error', error: e.message });
      }
    })();
    try { await flushing; } finally { flushing = null; }
  };

  store.refreshIfStale = async () => {
    if (!store.doc || fixture || pending.length || inflight) return;
    const r = await fetchFn(API + '?ref=' + BRANCH, { headers: heads(), cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j.sha && j.sha !== store.sha) await store.load();
  };

  return store;
}
