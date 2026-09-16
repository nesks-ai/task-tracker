import { html, cls, fmtDate, Dot, Badge, StageName, Icon, Btn, IMPORTANCE_COLOR, useState } from '../ui.js';
import { startBy, effectiveStartBy, isUrgent, isBlocked, isOverdue, badge, STAGES, DOMAINS, IMPORTANCE_LABELS, addDays } from '../model.js';

const Field = ({ label, children }) => html`<label class="block text-xs text-slate-500 space-y-1"><span>${label}</span>${children}</label>`;
const inputCls = 'w-full border rounded-md px-2 py-1 text-sm bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600';
const Text = ({ value, onCommit, placeholder, area }) => area
  ? html`<textarea class=${cls(inputCls, 'min-h-[96px]')} placeholder=${placeholder} value=${value || ''} onChange=${e => onCommit(e.target.value)} />`
  : html`<input class=${inputCls} placeholder=${placeholder} value=${value || ''} onChange=${e => onCommit(e.target.value)} />`;

function Shell({ title, onBack, onClose, ui, children }) {
  return html`
    ${!ui.isPhone ? html`<div class="fixed inset-0 z-10" onClick=${onClose}></div>` : null}
    <aside class=${cls('fixed z-30 bg-white dark:bg-slate-800 shadow-2xl overflow-y-auto flex flex-col', ui.isPhone ? 'inset-0' : 'top-0 right-0 bottom-0 w-[420px] border-l border-slate-200 dark:border-slate-700')}>
      <div class="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center gap-2">
        ${onBack ? html`<button onClick=${onBack} title="Back to project"><${Icon} name="back" /></button>` : null}
        <h2 class="font-semibold truncate flex-1">${title}</h2>
        <button onClick=${onClose} title="Close (Esc)"><${Icon} name="x" /></button>
      </div>
      <div class="p-4 space-y-4 flex-1">${children}</div>
    </aside>`;
}

function TaskDetail({ task, doc, c, ui, actions }) {
  const [chaseN, setChaseN] = useState(5);
  const up = patch => actions.updateTask(task.id, patch);
  const project = doc.projects.find(p => p.id === task.projectId);
  const siblings = c.tasks.filter(t => t.projectId === task.projectId && t.id !== task.id && t.stage !== 'done');
  const blockers = (task.blockedBy || []).map(id => c.byId.get(id)).filter(Boolean);
  const derived = [
    startBy(task) ? `Start by ${fmtDate(effectiveStartBy(task, c))}` : 'No date',
    isOverdue(task, c) ? 'overdue' : isUrgent(task, c) ? 'urgent' : null,
    isBlocked(task, c) ? `blocked by ${blockers.filter(b => b.stage !== 'done').map(b => b.title).join(', ')}` : null,
  ].filter(Boolean).join(' · ');
  return html`<${Shell} title=${task.title || 'Task'} ui=${ui} onClose=${actions.closePanel}
      onBack=${project ? () => actions.select('project', project.id) : null}>
    <${Field} label="Title"><${Text} value=${task.title} placeholder="What has to happen" onCommit=${v => up({ title: v })} /></${Field}>
    <div class="text-xs rounded-md bg-slate-100 dark:bg-slate-700/60 px-2 py-1.5 flex items-center gap-2"><${Badge} kind=${badge(task, c)} /><span>${derived}</span></div>
    <div class="grid grid-cols-2 gap-3">
      <${Field} label="Project"><select class=${inputCls} value=${task.projectId ?? ''} onChange=${e => up({ projectId: e.target.value || null })}>
        <option value="">Inbox</option>${doc.projects.map(p => html`<option value=${p.id}>${p.name}</option>`)}</select></${Field}>
      <${Field} label="Stage"><select class=${inputCls} value=${task.stage} onChange=${e => up({ stage: e.target.value })}>
        ${STAGES.map(s => html`<option value=${s}>${StageName(s)}</option>`)}</select></${Field}>
    </div>
    <${Field} label="Importance"><div class="flex gap-1">${[4, 3, 2, 1].map(n => html`<button title=${IMPORTANCE_LABELS[n]} onClick=${() => up({ importance: task.importance === n ? null : n })}
      class=${cls('flex-1 rounded-md py-1 text-sm text-white', IMPORTANCE_COLOR[n], task.importance === n ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white' : 'opacity-50 hover:opacity-100')}>${n}</button>`)}</div>
      <div class="text-[11px] text-slate-500 mt-1">${task.importance ? IMPORTANCE_LABELS[task.importance] : 'Unscored'}</div></${Field}>
    <div class="grid grid-cols-2 gap-3">
      <${Field} label="Due"><input type="date" class=${inputCls} value=${task.due || ''} onChange=${e => up({ due: e.target.value || null })} /></${Field}>
      <${Field} label="Lead time (days)"><input type="number" min="0" class=${inputCls} value=${task.leadDays ?? 1} onChange=${e => { const n = parseInt(e.target.value, 10); up({ leadDays: Number.isFinite(n) ? Math.max(0, n) : 0 }); }} /></${Field}>
    </div>
    <${Field} label="Detail"><${Text} area value=${task.detail} onCommit=${v => up({ detail: v })} /></${Field}>
    <div class="grid grid-cols-2 gap-3">
      <${Field} label="Owner"><${Text} value=${task.owner} onCommit=${v => up({ owner: v })} /></${Field}>
      <${Field} label="Waiting on"><${Text} value=${task.waitingOn} placeholder=${task.stage === 'waiting' ? 'Who' : 'Set stage to Waiting'} onCommit=${v => up({ waitingOn: v })} /></${Field}>
    </div>
    <${Field} label="Chase date"><div class="flex gap-2 items-center">
      <input type="date" class=${inputCls} value=${task.chaseDate || ''} onChange=${e => up({ chaseDate: e.target.value || null })} />
      <select class=${cls(inputCls, 'w-20')} value=${chaseN} onChange=${e => setChaseN(parseInt(e.target.value, 10))}>${[2, 5, 7].map(n => html`<option value=${n}>+${n}d</option>`)}</select>
      <${Btn} onClick=${() => up({ chaseDate: addDays(c.today, chaseN) })}>Chased today</${Btn}>
    </div></${Field}>
    <${Field} label="Blocked by">
      ${task.projectId === null ? html`<div class="text-xs text-slate-400">Move the task into a project to set blockers.</div>`
      : html`<select multiple class=${cls(inputCls, 'h-28')} onChange=${e => up({ blockedBy: [...e.target.selectedOptions].map(o => o.value) })}>
          ${siblings.map(s => html`<option value=${s.id} selected=${(task.blockedBy || []).includes(s.id)}>${s.title}</option>`)}</select>`}
    </${Field}>
    <div class="text-[11px] text-slate-500 space-y-0.5 border-t border-slate-200 dark:border-slate-700 pt-3">
      <div>source ${task.source}${task.legacyId ? ` · legacy ${task.legacyId}` : ''}</div>
      ${task.evidence ? html`<pre class="whitespace-pre-wrap font-sans">${task.evidence}</pre>` : null}
      <div>created ${task.createdAt.slice(0, 10)} · updated ${task.updatedAt.slice(0, 10)}${task.closedAt ? ` · closed ${task.closedAt.slice(0, 10)}` : ''}</div>
    </div>
    <div class="flex gap-2 justify-between pt-2">
      <${Btn} kind="danger" onClick=${() => { if (confirm('Delete this task?')) actions.deleteTask(task.id); }}>Delete</${Btn}>
      ${task.stage !== 'done' ? html`<${Btn} kind="primary" onClick=${() => up({ stage: 'done' })}>Mark done</${Btn}>` : html`<${Btn} onClick=${() => up({ stage: 'next' })}>Reopen</${Btn}>`}
    </div>
  </${Shell}>`;
}

function ProjectDetail({ project, doc, c, ui, actions }) {
  const [showAllDone, setShowAllDone] = useState(false);
  const up = patch => actions.updateProject(project.id, patch);
  const floor = addDays(c.today, -14);
  const mine = c.tasks.filter(t => t.projectId === project.id && (showAllDone || t.stage !== 'done' || (t.closedAt || '') >= floor));
  return html`<${Shell} title=${project.name} ui=${ui} onClose=${actions.closePanel}>
    <${Field} label="Name"><${Text} value=${project.name} onCommit=${v => up({ name: v })} /></${Field}>
    <div class="grid grid-cols-2 gap-3">
      <${Field} label="Domain"><select class=${inputCls} value=${project.domain ?? ''} onChange=${e => up({ domain: e.target.value || null })}>
        <option value="">Unassigned</option>${DOMAINS.map(d => html`<option value=${d}>${d}</option>`)}</select></${Field}>
      <${Field} label="Status"><select class=${inputCls} value=${project.status} onChange=${e => up({ status: e.target.value })}>
        ${['active', 'parked', 'done'].map(s => html`<option value=${s}>${s}</option>`)}</select></${Field}>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <${Field} label="Owner"><${Text} value=${project.owner} onCommit=${v => up({ owner: v })} /></${Field}>
      <${Field} label="Pinned"><${Btn} onClick=${() => up({ pinned: !project.pinned })}><${Icon} name="pin" /> ${project.pinned ? 'Pinned' : 'Pin to top'}</${Btn}></${Field}>
    </div>
    ${STAGES.map(s => { const list = mine.filter(t => t.stage === s); return list.length ? html`<div key=${s}>
      <h3 class="text-xs uppercase tracking-wide text-slate-500 mb-1">${StageName(s)} · ${list.length}</h3>
      ${list.map(t => { const after = (t.blockedBy || []).map(id => c.byId.get(id)).filter(b => b && b.stage !== 'done').map(b => b.title);
        return html`<button key=${t.id} class="w-full text-left flex items-start gap-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded px-1" onClick=${() => actions.select('task', t.id)}>
          <${Dot} importance=${t.importance} /><span class="flex-1 text-sm">${t.title}${after.length ? html`<span class="text-slate-500"> — after ${after.join(', ')}</span>` : null}</span>
          <span class="text-xs text-slate-500">${fmtDate(t.due)}</span><${Badge} kind=${badge(t, c)} /></button>`; })}
    </div>` : null; })}
    <div class="flex gap-2 justify-between pt-2">
      <${Btn} onClick=${() => setShowAllDone(v => !v)}>${showAllDone ? 'Hide old done' : 'Show all done'}</${Btn}>
      <${Btn} kind="primary" onClick=${() => actions.select('task', actions.addTask({ projectId: project.id }))}><${Icon} name="plus" /> Task in this project</${Btn}>
    </div>
  </${Shell}>`;
}

export default function DetailPanel({ doc, c, ui, actions }) {
  if (ui.selectedKind === 'task') {
    const task = c.byId.get(ui.selectedId);
    return task ? html`<${TaskDetail} task=${task} doc=${doc} c=${c} ui=${ui} actions=${actions} />` : null;
  }
  if (ui.selectedKind === 'project') {
    const project = doc.projects.find(p => p.id === ui.selectedId);
    return project ? html`<${ProjectDetail} project=${project} doc=${doc} c=${c} ui=${ui} actions=${actions} />` : null;
  }
  return null;
}
