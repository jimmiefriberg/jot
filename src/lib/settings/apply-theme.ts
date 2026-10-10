import { FONT_ROLE, fontFamilyFor } from './fonts';
import type { Settings } from './settings-schema';
import type { Theme } from './theme-presets';

function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** Writes the theme colours and font settings to CSS variables on the document root. */
export function applyThemeToDocument(theme: Theme, settings: Settings, fontSize: number): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${toKebabCase(name)}`, value);
  }
  root.style.setProperty('--font-editor', fontFamilyFor(FONT_ROLE.editor, settings.editorFont));
  root.style.setProperty('--font-preview', fontFamilyFor(FONT_ROLE.preview, settings.previewFont));
  root.style.setProperty('--font-size', `${fontSize}px`);
  root.style.setProperty('--line-height', String(settings.lineHeight));
  root.style.setProperty('--editor-maximum-width', `${settings.maximumLineWidth}ch`);
  root.dataset.textWidth = settings.maximumLineWidth > 0 ? 'limited' : 'full';
  root.style.colorScheme = theme.isDark ? 'dark' : 'light';
  root.dataset.theme = theme.isDark ? 'dark' : 'light';
}
