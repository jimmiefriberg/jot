/** Where a font is used: the editor (code, plain text) or the Markdown preview (prose). */
export const FONT_ROLE = { editor: 'editor', preview: 'preview' } as const;
export type FontRole = (typeof FONT_ROLE)[keyof typeof FONT_ROLE];

export interface FontOption {
  /** The name shown in Settings and stored in settings.json. */
  name: string;
  /** The CSS font-family, including fallbacks. */
  family: string;
  /** Bundled with the app, so it works without being installed. */
  isBundled?: boolean;
}

const MONOSPACE_FALLBACK = 'ui-monospace, Menlo, monospace';
const SANS_SERIF_FALLBACK = '-apple-system, system-ui, sans-serif';
const SERIF_FALLBACK = 'ui-serif, Georgia, serif';

export const EDITOR_FONTS: FontOption[] = [
  { name: 'SF Mono', family: `"SF Mono", ${MONOSPACE_FALLBACK}` },
  { name: 'JetBrains Mono', family: `"JetBrains Mono Variable", "JetBrains Mono", ${MONOSPACE_FALLBACK}`, isBundled: true },
  { name: 'Fira Code', family: `"Fira Code Variable", "Fira Code", ${MONOSPACE_FALLBACK}`, isBundled: true },
  { name: 'Menlo', family: `Menlo, ${MONOSPACE_FALLBACK}` },
  { name: 'Monaco', family: `Monaco, ${MONOSPACE_FALLBACK}` },
  { name: 'Courier New', family: `"Courier New", Courier, monospace` },
];

export const PREVIEW_FONTS: FontOption[] = [
  { name: 'System', family: `-apple-system, system-ui, "Helvetica Neue", sans-serif` },
  { name: 'Inter', family: `"Inter Variable", Inter, ${SANS_SERIF_FALLBACK}`, isBundled: true },
  { name: 'Helvetica Neue', family: `"Helvetica Neue", Helvetica, Arial, sans-serif` },
  { name: 'Avenir Next', family: `"Avenir Next", Avenir, ${SANS_SERIF_FALLBACK}` },
  { name: 'SF Rounded', family: `ui-rounded, "SF Pro Rounded", ${SANS_SERIF_FALLBACK}` },
  { name: 'New York', family: `ui-serif, "New York", Georgia, serif` },
  { name: 'Source Serif', family: `"Source Serif 4 Variable", "Source Serif 4", ${SERIF_FALLBACK}`, isBundled: true },
  { name: 'Georgia', family: `Georgia, ${SERIF_FALLBACK}` },
  { name: 'Times', family: `"Times New Roman", Times, serif` },
  { name: 'Palatino', family: `Palatino, "Palatino Linotype", ${SERIF_FALLBACK}` },
  { name: 'Iowan Old Style', family: `"Iowan Old Style", ${SERIF_FALLBACK}` },
  { name: 'Charter', family: `Charter, "Bitstream Charter", ${SERIF_FALLBACK}` },
];

const FONTS_BY_ROLE: Record<FontRole, FontOption[]> = {
  editor: EDITOR_FONTS,
  // Prose can also use a monospace font, for a typewriter look.
  preview: [...PREVIEW_FONTS, ...EDITOR_FONTS],
};

const FALLBACK_BY_ROLE: Record<FontRole, string> = {
  editor: MONOSPACE_FALLBACK,
  preview: SANS_SERIF_FALLBACK,
};

export const DEFAULT_EDITOR_FONT = 'SF Mono';
export const DEFAULT_PREVIEW_FONT = 'System';

export function getFontOptions(role: FontRole): FontOption[] {
  return FONTS_BY_ROLE[role];
}

export function isKnownFont(role: FontRole, name: string): boolean {
  return FONTS_BY_ROLE[role].some((option) => option.name === name);
}

/** The CSS font-family for a font name: a known font's own stack, or any installed font with sensible fallbacks. */
export function fontFamilyFor(role: FontRole, name: string): string {
  const option = FONTS_BY_ROLE[role].find((candidate) => candidate.name === name);
  if (option) return option.family;
  return `"${name.replaceAll('"', '')}", ${FALLBACK_BY_ROLE[role]}`;
}

function stripQuotes(text: string): string {
  return text.trim().replace(/^["']|["']$/g, '');
}

/**
 * Turns a full CSS stack saved by older versions (`"SF Mono", ui-monospace, …`) into the one font name it starts with.
 * System keywords map back to the built-in option they stand for.
 */
export function fontNameFromLegacyStack(role: FontRole, stack: string): string {
  const firstFamily = stripQuotes(stack.split(',')[0] ?? '');
  const matchingOption = FONTS_BY_ROLE[role].find((option) => stripQuotes(option.family.split(',')[0] ?? '') === firstFamily);
  if (matchingOption) return matchingOption.name;
  // Generic keywords (ui-monospace, system-ui, serif…) aren't font names; use the role's default instead.
  const isGenericKeyword = /^(ui-|-apple-|system-ui$|monospace$|sans-serif$|serif$)/.test(firstFamily);
  if (!firstFamily || isGenericKeyword) return role === FONT_ROLE.editor ? DEFAULT_EDITOR_FONT : DEFAULT_PREVIEW_FONT;
  return firstFamily;
}
