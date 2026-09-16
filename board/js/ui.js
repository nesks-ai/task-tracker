import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useMemo, useRef, useCallback } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import { IMPORTANCE_LABELS } from './model.js';

export const html = htm.bind(h);
export { h, render, useState, useEffect, useMemo, useRef, useCallback };

export const cls = (...a) => a.filter(Boolean).join(' ');

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const fmtDate = iso => iso ? `${parseInt(iso.slice(8, 10), 10)} ${MON[parseInt(iso.slice(5, 7), 10) - 1]}` : '';
export const STAGE_NAMES = { next: 'Next', doing: 'Doing', waiting: 'Waiting', parked: 'Parked', done: 'Done' };
export const StageName = s => STAGE_NAMES[s] || s;
export const IMPORTANCE_COLOR = { 4: 'bg-red-500', 3: 'bg-amber-500', 2: 'bg-sky-500', 1: 'bg-slate-400' };

export const Dot = ({ importance, size = 'w-2.5 h-2.5' }) => html`<span
  title=${importance ? `${importance} — ${IMPORTANCE_LABELS[importance]}` : 'Unscored'}
  class=${cls('inline-block rounded-full shrink-0', size,
    importance ? IMPORTANCE_COLOR[importance] : 'border border-slate-400 dark:border-slate-500')} />`;

const BADGE = {
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  urgent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  blocked: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  chase: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
};
export const Badge = ({ kind }) => kind ? html`<span class=${cls('text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide', BADGE[kind])}>${kind}</span>` : null;

const PATHS = {
  plus: 'M12 5v14M5 12h14', x: 'M18 6L6 18M6 6l12 12', undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z', sun: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chevron: 'M9 18l6-6-6-6', pin: 'M12 17v5M5 9l7-7 7 7-2 1v5l2 2H5l2-2v-5z', back: 'M15 18l-6-6 6-6',
};
export const Icon = ({ name, size = 16 }) => html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d=${PATHS[name]} /></svg>`;

export const Btn = ({ onClick, children, kind = 'ghost', title, disabled, class: extra }) => html`<button type="button" title=${title} disabled=${disabled} onClick=${onClick}
  class=${cls('inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm', extra,
    kind === 'primary' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90'
    : kind === 'danger' ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30'
    : 'hover:bg-slate-200/70 dark:hover:bg-slate-700/70', disabled && 'opacity-40 pointer-events-none')}>${children}</button>`;
