import { html } from '../ui.js';
export default function TimelineView({ doc, c, ui, actions }) {
  return html`<div class="p-6 text-slate-500">TimelineView view — ${c.tasks.length} tasks loaded</div>`;
}
