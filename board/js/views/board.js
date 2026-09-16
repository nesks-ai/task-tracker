import { html, cls, fmtDate, Dot, Badge, StageName, Icon, Btn, useState } from '../ui.js';
import { boardRows, badge, STAGES } from '../model.js';

export function TaskCard({ task, c, actions, draggable = true }) {
  const b = badge(task, c);
  return html`<div class=${cls('card rounded-md border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 p-2 text-sm shadow-sm hover:shadow', task.stage === 'done' && 'opacity-60')}
      draggable=${draggable} onDragStart=${e => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; }}
      onClick=${() => actions.select('task', task.id)}>
    <div class="flex items-start gap-1.5">
      <${Dot} importance=${task.importance} />
      <div class="flex-1 min-w-0 leading-snug line-clamp-2">${task.title || html`<span class="text-slate-400">Untitled</span>`}</div>
    </div>
    <div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
      ${task.due ? html`<span>${fmtDate(task.due)}</span>` : null}
      <${Badge} kind=${b} />
    </div>
  </div>`;
}

function Cell({ tasks, stage, projectId, actions, c, collapsed, onToggleDone }) {
  const [over, setOver] = useState(false);
  const drop = e => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData('text/plain'); if (id) actions.moveTask(id, { stage, projectId }); };
  return html`<div class=${cls('min-h-[56px] p-1.5 space-y-1.5 border-l border-slate-200/70 dark:border-slate-700/70', over && 'drop-ok')}
      onDragOver=${e => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)} onDrop=${drop}>
    ${collapsed
      ? html`<button class="text-xs text-slate-500 hover:underline" onClick=${onToggleDone}>${tasks.length} done</button>`
      : tasks.map(t => html`<${TaskCard} key=${t.id} task=${t} c=${c} actions=${actions} />`)}
  </div>`;
}

function RowHeader({ project, columns, collapsed, onToggle, actions }) {
  const isInbox = project.id === null;
  const total = STAGES.filter(s => s !== 'done').reduce((n, s) => n + columns[s].length, 0);
  return html`<div class="p-2 flex items-start gap-1 sticky left-0 bg-stone-50 dark:bg-slate-900">
    <button class=${cls('mt-0.5 transition-transform', !collapsed && 'rotate-90')} onClick=${onToggle}><${Icon} name="chevron" /></button>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1">
        <button class=${cls('font-medium truncate text-left', !isInbox && 'hover:underline')} disabled=${isInbox}
          onClick=${() => !isInbox && actions.select('project', project.id)}>${project.name}</button>
        ${!isInbox ? html`<button title=${project.pinned ? 'Unpin' : 'Pin to top'} class=${cls('opacity-40 hover:opacity-100', project.pinned && 'opacity-100 text-amber-600')}
          onClick=${() => actions.updateProject(project.id, { pinned: !project.pinned })}><${Icon} name="pin" size=${14} /></button>` : null}
      </div>
      <div class="text-xs text-slate-500 flex items-center gap-2">
        ${project.domain ? html`<span class="px-1 rounded bg-slate-200 dark:bg-slate-700">${project.domain}</span>` : null}
        <span>${total} open</span>
        ${collapsed ? html`<span>· ${STAGES.map(s => `${columns[s].length} ${StageName(s).toLowerCase()}`).join(' · ')}</span>` : null}
      </div>
    </div>
    <button title="Add task here" class="opacity-40 hover:opacity-100" onClick=${() => actions.select('task', actions.addTask({ projectId: project.id }))}><${Icon} name="plus" size=${14} /></button>
  </div>`;
}

function Desktop({ rows, ui, actions, c }) {
  const [collapsed, setCollapsed] = useState({});
  const [doneOpen, setDoneOpen] = useState({});
  const toggle = (set, id) => set(m => ({ ...m, [id]: !m[id] }));
  return html`<div class="overflow-x-auto">
    <div class="grid min-w-[1100px]" style="grid-template-columns: 220px repeat(5, minmax(0, 1fr));">
      <div class="p-2 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-700">Project</div>
      ${STAGES.map(s => html`<div class="p-2 text-xs uppercase tracking-wide text-slate-500 border-b border-l border-slate-200 dark:border-slate-700">${StageName(s)}</div>`)}
      ${rows.map(({ project, columns }) => {
        const key = project.id ?? '__inbox';
        const isCollapsed = !!collapsed[key];
        return html`<div class="contents" key=${key}>
          <div class="border-b border-slate-200 dark:border-slate-700"><${RowHeader} project=${project} columns=${columns} collapsed=${isCollapsed} onToggle=${() => toggle(setCollapsed, key)} actions=${actions} /></div>
          ${STAGES.map(s => html`<div class="border-b border-slate-200 dark:border-slate-700">
            ${isCollapsed ? html`<div class="p-2 text-xs text-slate-400 border-l border-slate-200/70 dark:border-slate-700/70">${columns[s].length}</div>`
              : html`<${Cell} tasks=${columns[s]} stage=${s} projectId=${project.id} actions=${actions} c=${c}
                  collapsed=${s === 'done' && !doneOpen[key]} onToggleDone=${() => toggle(setDoneOpen, key)} />`}
          </div>`)}
        </div>`;
      })}
    </div>
    <div class="p-3"><${Btn} onClick=${actions.toggleHidden}>${ui.showHidden ? 'Hide' : 'Show'} parked/done projects</${Btn}></div>
  </div>`;
}

function Phone({ rows, ui, actions, c }) {
  const [stage, setStage] = useState('next');
  const row = rows.find(r => r.project.id === ui.phoneProject) || rows[0];
  return html`<div class="p-2 space-y-2">
    <select class="w-full border rounded-md px-2 py-1 dark:bg-slate-800" value=${row.project.id ?? ''}
      onChange=${e => { ui.phoneProject = e.target.value || null; actions.setView('board'); }}>
      ${rows.map(r => html`<option value=${r.project.id ?? ''}>${r.project.name}</option>`)}
    </select>
    <div class="flex gap-1 overflow-x-auto">${STAGES.map(s => html`<button onClick=${() => setStage(s)}
      class=${cls('px-3 py-1 rounded-full text-sm whitespace-nowrap', stage === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-700')}>${StageName(s)} ${row.columns[s].length}</button>`)}</div>
    <div class="space-y-2">${row.columns[stage].map(t => html`<div key=${t.id}>
      <${TaskCard} task=${t} c=${c} actions=${actions} draggable=${false} />
      <select class="mt-1 w-full text-sm border rounded-md px-2 py-1 dark:bg-slate-800" value=${t.stage}
        onChange=${e => actions.moveTask(t.id, { stage: e.target.value })}>
        ${STAGES.map(s => html`<option value=${s}>Move to ${StageName(s)}</option>`)}
      </select></div>`)}
      ${!row.columns[stage].length ? html`<div class="text-sm text-slate-400 p-4 text-center">Nothing here</div>` : null}
    </div>
    ${row.project.id !== null ? html`<${Btn} onClick=${() => actions.select('project', row.project.id)}>Open project</${Btn}>` : null}
  </div>`;
}

export default function BoardView({ doc, c, ui, actions }) {
  const rows = boardRows(c, { showHidden: ui.showHidden, doneDays: 14 });
  return ui.isPhone ? html`<${Phone} rows=${rows} ui=${ui} actions=${actions} c=${c} />` : html`<${Desktop} rows=${rows} ui=${ui} actions=${actions} c=${c} />`;
}
