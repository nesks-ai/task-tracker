import { html, cls, fmtDate, IMPORTANCE_COLOR } from '../ui.js';
import { timelineBars, daysBetween } from '../model.js';

const LABEL_W = 220;

export default function TimelineView({ doc, c, ui, actions }) {
  if (ui.isPhone) return html`<div class="p-6 text-sm text-slate-500">The timeline needs a wider screen.</div>`;
  const tl = timelineBars(c, { weeksBack: 8, weeksFwd: 12 });
  const totalDays = daysBetween(tl.start, tl.end) + 1;                 // 140
  const pct = iso => (daysBetween(tl.start, iso) / totalDays) * 100;
  const todayLeft = pct(c.today);
  const weekW = 100 / tl.weeks.length;
  return html`<div class="overflow-x-auto">
    <div class="min-w-[1200px] relative">
      <div class="flex sticky top-0 bg-stone-50 dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-700">
        <div style=${`width:${LABEL_W}px`} class="shrink-0 p-2 text-xs uppercase tracking-wide text-slate-500">Project</div>
        <div class="flex-1 relative h-8">
          ${tl.weeks.map((w, i) => html`<div class=${cls('absolute top-0 h-full border-l text-[11px] pl-1 pt-2 text-slate-500', w <= c.today && c.today < (tl.weeks[i + 1] || '9999') ? 'font-semibold text-slate-900 dark:text-white border-slate-400' : 'border-slate-200/70 dark:border-slate-700/70')}
            style=${`left:${i * weekW}%; width:${weekW}%`}>${fmtDate(w)}</div>`)}
        </div>
      </div>
      ${tl.rows.map(({ project, undated, bars }) => {
        const outside = bars.filter(b => b.start > tl.end || b.end < tl.start).length;
        return html`<div key=${project.id ?? '__inbox'} class="flex border-b border-slate-200/70 dark:border-slate-700/70">
        <div style=${`width:${LABEL_W}px`} class="shrink-0 p-2 sticky left-0 bg-stone-50 dark:bg-slate-900">
          <button class=${cls('font-medium text-sm text-left truncate block max-w-full', project.id !== null && 'hover:underline')} disabled=${project.id === null}
            onClick=${() => project.id !== null && actions.select('project', project.id)}>${project.name}</button>
          <div class="text-[11px] text-slate-500">${bars.length} dated${undated ? ` · ${undated} undated` : ''}${outside ? ` · ${outside} outside window` : ''}</div>
        </div>
        <div class="flex-1 relative" style=${`height:${Math.max(40, bars.length * 22 + 8)}px`}>
          ${tl.weeks.map((w, i) => html`<div class="absolute top-0 bottom-0 border-l border-slate-200/50 dark:border-slate-700/50" style=${`left:${i * weekW}%`}></div>`)}
          <div class="absolute top-0 bottom-0 border-l-2 border-slate-900 dark:border-white z-[5]" style=${`left:${todayLeft}%`}></div>
          ${bars.map((b, i) => {
            if (b.start > tl.end || b.end < tl.start) return null;
            const startPct = pct(b.start < tl.start ? tl.start : b.start);
            const endPct = pct(b.end > tl.end ? tl.end : b.end) + (100 / totalDays);
            const oneDay = b.start === b.end;
            return html`<button key=${b.task.id} title=${`${b.task.title} · start by ${fmtDate(b.start)} · due ${fmtDate(b.task.due)}`}
              onClick=${() => actions.select('task', b.task.id)}
              class=${cls('absolute h-4 rounded-sm text-[10px] text-white px-1 truncate text-left', IMPORTANCE_COLOR[b.task.importance] || 'bg-slate-400',
                b.blocked && 'hatched', b.overdue && 'border-r-4 border-red-700')}
              style=${`top:${4 + i * 22}px; left:${startPct}%; ${oneDay ? 'width:6px' : `width:${Math.max(0.6, endPct - startPct)}%`}`}>${oneDay ? '' : b.task.title}</button>`;
          })}
        </div>
      </div>`;
      })}
    </div>
  </div>`;
}
