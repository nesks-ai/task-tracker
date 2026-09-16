import { html, cls, fmtDate, IMPORTANCE_COLOR } from '../ui.js';
import { matrixBuckets, IMPORTANCE_LABELS } from '../model.js';
import { TaskCard } from './board.js';

const Q = [
  ['now', 'Do now', 'Important and urgent'],
  ['schedule', 'Schedule', 'Important, not yet urgent'],
  ['quick', 'Quick or delegate', 'Urgent, low stakes'],
  ['park', 'Park or kill', 'Neither'],
];

function projectName(doc, id) { return id === null ? 'Inbox' : (doc.projects.find(p => p.id === id) || {}).name || '?'; }

function Quadrant({ k, title, sub, tasks, doc, c, actions }) {
  return html`<section class=${cls('rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col min-h-[220px] max-h-[48vh]',
      k === 'now' && 'border-red-300 dark:border-red-800')}>
    <header class="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-baseline gap-2">
      <h2 class="font-semibold">${title}</h2><span class="text-xs text-slate-500">${sub}</span>
      <span class="ml-auto text-xs text-slate-500">${tasks.length}</span>
    </header>
    <div class="p-2 space-y-1.5 overflow-y-auto">
      ${tasks.map(t => html`<div key=${t.id}>
        <${TaskCard} task=${t} c=${c} actions=${actions} draggable=${false} />
        <div class="text-[11px] text-slate-500 pl-1 -mt-0.5">${projectName(doc, t.projectId)}</div>
      </div>`)}
      ${!tasks.length ? html`<div class="text-sm text-slate-400 p-4 text-center">Empty</div>` : null}
    </div>
  </section>`;
}

function ImportancePicker({ task, actions }) {
  return html`<div class="flex gap-0.5">${[4, 3, 2, 1].map(n => html`<button title=${`${n} — ${IMPORTANCE_LABELS[n]}`}
    onClick=${() => actions.updateTask(task.id, { importance: n })}
    class=${cls('w-6 h-6 rounded text-xs font-medium text-white', IMPORTANCE_COLOR[n], task.importance === n ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white' : 'opacity-60 hover:opacity-100')}>${n}</button>`)}</div>`;
}

function TrayRow({ task, doc, actions }) {
  return html`<div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center py-2 border-b border-slate-200/70 dark:border-slate-700/70">
    <button class="text-left min-w-0" onClick=${() => actions.select('task', task.id)}>
      <div class="truncate text-sm">${task.title || 'Untitled'}</div>
      <div class="text-[11px] text-slate-500">${projectName(doc, task.projectId)}${task.due ? ` · due ${fmtDate(task.due)}` : ''}</div>
    </button>
    <${ImportancePicker} task=${task} actions=${actions} />
    <input type="date" class="border rounded-md px-1 py-0.5 text-sm dark:bg-slate-800" value=${task.due || ''}
      onChange=${e => actions.updateTask(task.id, { due: e.target.value || null })} />
    <label class="text-xs text-slate-500 flex items-center gap-1">lead
      <input type="number" min="0" class="w-14 border rounded-md px-1 py-0.5 text-sm dark:bg-slate-800" value=${task.leadDays ?? 1}
        onChange=${e => { const n = parseInt(e.target.value, 10); actions.updateTask(task.id, { leadDays: Number.isFinite(n) ? Math.max(0, n) : 0 }); }} /></label>
  </div>`;
}

export default function MatrixView({ doc, c, ui, actions }) {
  const b = matrixBuckets(c);
  return html`<div class="p-3 space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${Q.map(([k, title, sub]) => html`<${Quadrant} key=${k} k=${k} title=${title} sub=${sub} tasks=${b[k]} doc=${doc} c=${c} actions=${actions} />`)}
    </div>
    <section class="rounded-lg border border-amber-300 dark:border-amber-800">
      <header class="px-3 py-2 border-b border-amber-200 dark:border-amber-800 flex items-baseline gap-2">
        <h2 class="font-semibold">Tray</h2><span class="text-xs text-slate-500">score or date these so they stop hiding</span>
        <span class="ml-auto text-xs text-slate-500">${b.unscored.length + b.undated.length}</span>
      </header>
      ${[['Unscored', b.unscored], ['Undated', b.undated]].map(([label, list]) => html`<div class="px-3 pt-2">
        <h3 class="text-xs uppercase tracking-wide text-slate-500">${label} · ${list.length}</h3>
        ${list.map(t => html`<${TrayRow} key=${t.id} task=${t} doc=${doc} actions=${actions} />`)}
        ${!list.length ? html`<div class="text-sm text-slate-400 py-2">None</div>` : null}
      </div>`)}
    </section>
  </div>`;
}
