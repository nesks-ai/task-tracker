import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../js/model.js';

const doc = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
const TODAY = '2026-09-16';
const c = M.ctx(doc, TODAY);
const t = id => c.byId.get(id);

test('addDays crosses month ends and DST without drift', () => {
  assert.equal(M.addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(M.addDays('2026-03-29', 1), '2026-03-30');   // UK DST switch day
  assert.equal(M.addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(M.addDays('2026-09-16', 0), '2026-09-16');
});

test('startBy subtracts leadDays in calendar days; null without due', () => {
  assert.equal(M.startBy(t('b_urgent_today')), '2026-09-16');
  assert.equal(M.startBy(t('b_quick')), '2026-09-16');       // leadDays 0
  assert.equal(M.startBy(t('b_undated')), null);
});

test('isOverdue: due before today and not done', () => {
  assert.equal(M.isOverdue(t('b_overdue'), c), true);
  assert.equal(M.isOverdue(t('b_quick'), c), false);        // due today is not overdue
  assert.equal(M.isOverdue(t('b_done_old'), c), false);
  assert.equal(M.isOverdue(t('b_parked'), c), true);        // parked but dated in the past still reads overdue
});

test('isBlocked: open blocker blocks; dangling and done blockers do not', () => {
  assert.equal(M.isBlocked(t('b_blocked'), c), true);
  assert.equal(M.isBlocked(t('b_dangling'), c), false);
  assert.equal(M.isBlocked(t('b_blocker'), c), false);
});

test('effectiveStartBy pulls the earliest downstream start-by up to the blocker', () => {
  assert.equal(M.effectiveStartBy(t('b_blocker'), c), '2026-09-16');   // from b_blocked (due 17, lead 1)
  assert.equal(M.effectiveStartBy(t('b_blocked'), c), '2026-09-16');
  assert.equal(M.effectiveStartBy(t('b_not_yet'), c), '2026-09-17');
});

test('effectiveStartBy survives a cycle and falls back to own startBy', () => {
  assert.equal(M.effectiveStartBy(t('b_cycle_a'), c), '2026-09-24');
  assert.equal(M.effectiveStartBy(t('b_cycle_b'), c), '2026-09-24');   // min over the pair
});

test('isUrgent: startBy <= today; blocked never urgent; blocker inherits; done/parked never', () => {
  assert.equal(M.isUrgent(t('b_urgent_today'), c), true);
  assert.equal(M.isUrgent(t('b_not_yet'), c), false);
  assert.equal(M.isUrgent(t('b_overdue'), c), true);
  assert.equal(M.isUrgent(t('b_blocked'), c), false);
  assert.equal(M.isUrgent(t('b_blocker'), c), true);
  assert.equal(M.isUrgent(t('b_dangling'), c), true);
  assert.equal(M.isUrgent(t('b_parked'), c), false);
  assert.equal(M.isUrgent(t('b_done_recent'), c), false);
  assert.equal(M.isUrgent(t('b_undated'), c), false);
});

test('quadrant mapping and trays', () => {
  assert.equal(M.quadrant(t('b_overdue'), c), 'now');
  assert.equal(M.quadrant(t('b_urgent_today'), c), 'now');
  assert.equal(M.quadrant(t('b_not_yet'), c), 'schedule');
  assert.equal(M.quadrant(t('b_quick'), c), 'quick');
  assert.equal(M.quadrant(t('b_park'), c), 'park');
  assert.equal(M.quadrant(t('b_unscored'), c), 'unscored');
  assert.equal(M.quadrant(t('b_undated'), c), 'undated');
  assert.equal(M.quadrant(t('b_both_null'), c), 'unscored');   // unscored wins
  assert.equal(M.quadrant(t('b_parked'), c), null);
  assert.equal(M.quadrant(t('b_done_recent'), c), null);
  assert.equal(M.quadrant(t('b_blocked'), c), 'schedule');     // important but not urgent while blocked
});

test('isChaseDue only for waiting tasks with chaseDate <= today', () => {
  assert.equal(M.isChaseDue(t('b_waiting_chase'), c), true);
  assert.equal(M.isChaseDue(t('b_waiting_later'), c), false);
  assert.equal(M.isChaseDue(t('b_quick'), c), false);
});

test('badge priority: overdue > urgent > blocked > chase > null', () => {
  assert.equal(M.badge(t('b_overdue'), c), 'overdue');
  assert.equal(M.badge(t('b_urgent_today'), c), 'urgent');
  assert.equal(M.badge(t('b_blocked'), c), 'blocked');
  assert.equal(M.badge(t('b_waiting_chase'), c), 'chase');
  assert.equal(M.badge(t('b_not_yet'), c), null);
});

test('projectUrgency: 2 overdue, 1 urgent, 0 none; done/parked tasks ignored', () => {
  assert.equal(M.projectUrgency('p_cgl', c), 2);
  assert.equal(M.projectUrgency('p_ssl', c), 1);
  assert.equal(M.projectUrgency('p_lisbon', c), 1);       // b_quick is urgent
  assert.equal(M.projectUrgency(null, c), 0);             // inbox: unscored/undated are not urgent... b_unscored due 18, lead 1 → startBy 17 → not urgent
});

test('sortProjects: pinned first, then urgency desc, then order; hidden statuses excluded unless asked', () => {
  const ids = M.sortProjects(c, { showHidden: false }).map(p => p.id);
  assert.deepEqual(ids, ['p_lisbon', 'p_cgl', 'p_ssl']);
  const all = M.sortProjects(c, { showHidden: true }).map(p => p.id);
  // p_old is parked but its one task is overdue → urgency 2, ties with p_cgl, order 2 < 9
  assert.deepEqual(all, ['p_lisbon', 'p_cgl', 'p_old', 'p_ssl']);
});

test('boardRows: Inbox first, five columns, done limited to the window', () => {
  const rows = M.boardRows(c, { showHidden: false, doneDays: 14 });
  assert.equal(rows[0].project.id, null);
  assert.equal(rows[0].project.name, 'Inbox');
  assert.deepEqual(rows.map(r => r.project.id), [null, 'p_lisbon', 'p_cgl', 'p_ssl']);
  const cgl = rows.find(r => r.project.id === 'p_cgl');
  assert.deepEqual(Object.keys(cgl.columns), ['next', 'doing', 'waiting', 'parked', 'done']);
  assert.deepEqual(cgl.columns.done.map(x => x.id), ['b_done_recent']);
  assert.deepEqual(cgl.columns.parked.map(x => x.id), ['b_parked']);
  assert.deepEqual(rows[0].columns.next.map(x => x.id).sort(), ['b_both_null', 'b_undated', 'b_unscored']);
});

test('boardRows: within a column, overdue/urgent first then due asc then importance desc', () => {
  const rows = M.boardRows(c, { showHidden: false, doneDays: 14 });
  const ssl = rows.find(r => r.project.id === 'p_ssl');
  // urgent ones first (b_dangling due 16, b_blocker due 30-Oct but urgent by inheritance), then the rest by due
  assert.deepEqual(ssl.columns.next.map(x => x.id), ['b_dangling', 'b_blocker', 'b_blocked', 'b_cycle_a', 'b_cycle_b']);
});

test('matrixBuckets excludes done and parked and fills both trays', () => {
  const b = M.matrixBuckets(c);
  // b_blocker is urgent by inheritance but importance 2 → quick, not now.
  // b_in_parked_project sits in a parked PROJECT but is itself next/overdue/importance 4 → now.
  assert.deepEqual(b.now.map(x => x.id), ['b_overdue', 'b_in_parked_project', 'b_urgent_today']);
  assert.deepEqual(b.quick.map(x => x.id), ['b_dangling', 'b_quick', 'b_blocker']);
  assert.deepEqual(b.schedule.map(x => x.id), ['b_blocked', 'b_not_yet', 'b_cycle_a', 'b_cycle_b', 'b_waiting_chase']);
  assert.deepEqual(b.park.map(x => x.id), ['b_waiting_later', 'b_park']);
  assert.deepEqual(b.unscored.map(x => x.id), ['b_unscored', 'b_both_null']);
  assert.deepEqual(b.undated.map(x => x.id), ['b_undated']);
});

test('matrixBuckets sorts each cell by due asc then importance desc', () => {
  const b = M.matrixBuckets(c);
  assert.deepEqual(b.quick.map(x => x.due), ['2026-09-16', '2026-09-16', '2026-10-30']);
  assert.ok(b.quick[0].importance >= b.quick[1].importance);
});

test('timelineBars: 20 Monday-start weeks, bars per open dated task, overdue extends to today', () => {
  const tl = M.timelineBars(c, { weeksBack: 8, weeksFwd: 12 });
  assert.equal(tl.weeks.length, 20);
  assert.equal(tl.weeks[0], '2026-07-20');                 // Monday 8 weeks before the week of 16-Sep (Mon 14-Sep)
  assert.equal(tl.start, '2026-07-20');
  assert.equal(tl.end, '2026-12-06');                       // Sunday closing the 20th week
  const cgl = tl.rows.find(r => r.project.id === 'p_cgl');
  const ov = cgl.bars.find(b => b.task.id === 'b_overdue');
  assert.deepEqual([ov.start, ov.end, ov.overdue, ov.blocked], ['2026-09-09', TODAY, true, false]);
  const nb = cgl.bars.find(b => b.task.id === 'b_not_yet');
  assert.deepEqual([nb.start, nb.end, nb.overdue], ['2026-09-17', '2026-09-20', false]);
  assert.equal(cgl.bars.some(b => b.task.id === 'b_done_recent'), false);
  assert.equal(cgl.bars.some(b => b.task.id === 'b_parked'), false);
  const ssl = tl.rows.find(r => r.project.id === 'p_ssl');
  assert.equal(ssl.bars.find(b => b.task.id === 'b_blocked').blocked, true);
  const inbox = tl.rows.find(r => r.project.id === null);
  assert.equal(inbox.undated, 2);
});

test('newId format', () => {
  assert.match(M.newId('b'), /^b_[0-9a-z]{6}_[0-9a-z]{4}$/);
  assert.notEqual(M.newId('p'), M.newId('p'));
});
