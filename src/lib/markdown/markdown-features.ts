import emojiByName from 'markdown-it-emoji/lib/data/full.mjs';

import type { TextRange } from '../documents/text-change';

/** GitHub's alert (callout) kinds: `> [!NOTE]`, `> [!TIP]`, … */
export const ALERT_KIND = {
  note: 'note',
  tip: 'tip',
  important: 'important',
  warning: 'warning',
  caution: 'caution',
} as const;
export type AlertKind = (typeof ALERT_KIND)[keyof typeof ALERT_KIND];

export const ALERT_TITLES: Record<AlertKind, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
};

const ALERT_MARKER = /^\s*>\s*\[!(note|tip|important|warning|caution)\]\s*$/i;
const FRONT_MATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
const FRONT_MATTER_SEARCH_LIMIT = 50_000;

function isAlertKind(value: string): value is AlertKind {
  return value in ALERT_TITLES;
}

/** The alert kind a blockquote's first line declares, like `> [!WARNING]`, or null for a plain quote. */
export function readAlertKind(firstLineText: string): AlertKind | null {
  const kind = ALERT_MARKER.exec(firstLineText)?.[1].toLowerCase();
  return kind && isAlertKind(kind) ? kind : null;
}

/** The YAML front matter block at the very start of a note (`---` … `---`), or null when there is none. */
export function findFrontMatter(text: string): TextRange | null {
  const match = FRONT_MATTER.exec(text.slice(0, FRONT_MATTER_SEARCH_LIMIT));
  if (!match) return null;
  return { from: 0, to: match[0].replace(/\r?\n$/, '').length };
}

/** The emoji for a GitHub shortcode name (`tada` → 🎉), or null when it isn't one. */
export function emojiForShortcode(name: string): string | null {
  return Object.hasOwn(emojiByName, name) ? emojiByName[name] : null;
}
