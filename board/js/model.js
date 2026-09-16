// Pure derivations for the Board Tracker. No DOM, no fetch, no Date.now():
// `today` is always passed in as 'YYYY-MM-DD'. See spec §3.2.

export const STAGES = ['next', 'doing', 'waiting', 'parked', 'done'];
export const DOMAINS = ['ssl', 'cashbaba', 'cgl', 'oil-otl', 'family-office', 'personal'];
export const IMPORTANCE_LABELS = {
  4: 'Money or licence at risk, or a board/MD commitment',
  3: 'Moves a live decision or a key relationship',
  2: 'Useful, nobody blocked',
  1: 'Nice to have',
};
export const INBOX = { id: null, name: 'Inbox', domain: null, status: 'active', order: -1, pinned: true };

const DAY = 86400000;
const toUTC = iso => new Date(iso + 'T00:00:00Z');
const fromUTC = d => d.toISOString().slice(0, 10);

export function addDays(iso, n) {
  return fromUTC(new Date(toUTC(iso).getTime() + n * DAY));
}
export function daysBetween(a, b) {            // b - a in days
  return Math.round((toUTC(b) - toUTC(a)) / DAY);
}
export function mondayOf(iso) {
  const d = toUTC(iso);
  const dow = (d.getUTCDay() + 6) % 7;         // Mon=0 … Sun=6
  return addDays(iso, -dow);
}

export function ctx(doc, today) {
  const tasks = doc.tasks || [];
  const byId = new Map(tasks.map(t => [t.id, t]));
  return { today, tasks, byId, projects: doc.projects || [] };
}

export const isOpen = task => task.stage !== 'done';

export function startBy(task) {
  if (!task.due) return null;
  const lead = task.leadDays == null ? 1 : Number(task.leadDays);
  return addDays(task.due, -lead);
}

export function isOverdue(task, c) {
  return !!task.due && task.due < c.today && task.stage !== 'done';
}

export function isBlocked(task, c) {
  return (task.blockedBy || []).some(id => {
    const b = c.byId.get(id);
    return b && isOpen(b);
  });
}

function dependents(task, c) {
  return c.tasks.filter(t => isOpen(t) && (t.blockedBy || []).includes(task.id));
}

export function effectiveStartBy(task, c, seen = new Set()) {
  const own = startBy(task);
  if (seen.has(task.id)) return own;           // cycle: stop here, use own
  seen.add(task.id);
  let best = own;
  for (const d of dependents(task, c)) {
    const s = effectiveStartBy(d, c, seen);
    if (s && (!best || s < best)) best = s;
  }
  return best;
}

export function isUrgent(task, c) {
  if (task.stage === 'done' || task.stage === 'parked') return false;
  if (isBlocked(task, c)) return false;
  const s = effectiveStartBy(task, c);
  return !!s && s <= c.today;
}

export function quadrant(task, c) {
  if (task.stage === 'done' || task.stage === 'parked') return null;
  if (task.importance == null) return 'unscored';
  if (!task.due) return 'undated';
  const important = task.importance >= 3;
  const urgent = isUrgent(task, c);
  if (important) return urgent ? 'now' : 'schedule';
  return urgent ? 'quick' : 'park';
}

export function isChaseDue(task, c) {
  return task.stage === 'waiting' && !!task.chaseDate && task.chaseDate <= c.today;
}

export function badge(task, c) {
  if (isOverdue(task, c)) return 'overdue';
  if (isUrgent(task, c)) return 'urgent';
  if (isBlocked(task, c)) return 'blocked';
  if (isChaseDue(task, c)) return 'chase';
  return null;
}

export function projectUrgency(projectId, c) {
  let level = 0;
  for (const t of c.tasks) {
    if (t.projectId !== projectId || t.stage === 'done' || t.stage === 'parked') continue;
    if (isOverdue(t, c)) return 2;
    if (isUrgent(t, c)) level = 1;
  }
  return level;
}

export function sortProjects(c, { showHidden = false } = {}) {
  const list = c.projects.filter(p => showHidden || p.status === 'active');
  const urg = new Map(list.map(p => [p.id, projectUrgency(p.id, c)]));
  return [...list].sort((a, b) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
    urg.get(b.id) - urg.get(a.id) ||
    (a.order ?? 0) - (b.order ?? 0) ||
    a.name.localeCompare(b.name));
}

// Column order inside a board cell: overdue, then urgent, then due asc (undated last), then importance desc.
function cellSort(c) {
  const rank = t => (isOverdue(t, c) ? 0 : isUrgent(t, c) ? 1 : 2);
  return (a, b) =>
    rank(a) - rank(b) ||
    (a.due || '9999').localeCompare(b.due || '9999') ||
    (b.importance ?? 0) - (a.importance ?? 0) ||
    a.title.localeCompare(b.title);
}

export function doneWindow(tasks, today, days) {
  const floor = addDays(today, -days);
  return tasks.filter(t => t.stage === 'done' && (t.closedAt || '').slice(0, 10) >= floor);
}

export function boardRows(c, { showHidden = false, doneDays = 14 } = {}) {
  const projects = [INBOX, ...sortProjects(c, { showHidden })];
  const sorter = cellSort(c);
  return projects.map(project => {
    const mine = c.tasks.filter(t => t.projectId === project.id);
    const columns = {};
    for (const s of STAGES) {
      const col = s === 'done' ? doneWindow(mine, c.today, doneDays) : mine.filter(t => t.stage === s);
      columns[s] = [...col].sort(s === 'done'
        ? (a, b) => (b.closedAt || '').localeCompare(a.closedAt || '')
        : sorter);
    }
    return { project, columns };
  });
}

export function matrixBuckets(c) {
  const b = { now: [], schedule: [], quick: [], park: [], unscored: [], undated: [] };
  for (const t of c.tasks) {
    const q = quadrant(t, c);
    if (q) b[q].push(t);
  }
  const bySort = (x, y) =>
    (x.due || '9999').localeCompare(y.due || '9999') ||
    (y.importance ?? 0) - (x.importance ?? 0) ||
    x.title.localeCompare(y.title);
  for (const k of Object.keys(b)) b[k].sort(bySort);
  return b;
}

export function timelineBars(c, { weeksBack = 8, weeksFwd = 12 } = {}) {
  const thisMonday = mondayOf(c.today);
  const start = addDays(thisMonday, -7 * weeksBack);
  const weeks = [];
  for (let i = 0; i < weeksBack + weeksFwd; i++) weeks.push(addDays(start, 7 * i));
  const end = addDays(start, 7 * (weeksBack + weeksFwd) - 1);
  const projects = [INBOX, ...sortProjects(c, { showHidden: false })];
  const rows = projects.map(project => {
    const mine = c.tasks.filter(t => t.projectId === project.id && t.stage !== 'done' && t.stage !== 'parked');
    const undated = mine.filter(t => !t.due).length;
    const bars = mine.filter(t => t.due).map(task => {
      const overdue = isOverdue(task, c);
      return {
        task,
        start: startBy(task),
        end: overdue ? c.today : task.due,
        overdue,
        blocked: isBlocked(task, c),
      };
    }).sort((a, b) => a.start.localeCompare(b.start));
    return { project, undated, bars };
  });
  return { start, end, weeks, rows };
}

const b36 = n => n.toString(36);
export function newId(prefix) {
  const t = b36(Date.now()).slice(-6);
  const r = Array.from({ length: 4 }, () => b36(Math.floor(Math.random() * 36))).join('');
  return `${prefix}_${t}_${r}`;
}
