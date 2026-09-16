import { html } from '../ui.js';
export default function DetailPanel({ doc, c, ui, actions }) {
  return html`<div class="p-6 text-slate-500">DetailPanel view — ${c.tasks.length} tasks loaded</div>`;
}
