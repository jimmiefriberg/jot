import { VIEW_MODE } from '../documents/file-kind';
import type { FormattableKind, ViewMode } from '../documents/file-kind';
import { DEFAULT_EDITOR_FONT, DEFAULT_PREVIEW_FONT, FONT_ROLE, fontNameFromLegacyStack } from './fonts';
import { BUILT_IN_THEMES, DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID, THEME_COLOR_LABELS } from './theme-presets';
import type { Theme, ThemeColors } from './theme-presets';

export const APPEARANCE = { system: 'system', light: 'light', dark: 'dark' } as const;
export type Appearance = (typeof APPEARANCE)[keyof typeof APPEARANCE];

export const SIDEBAR_SIDE = { left: 'left', right: 'right' } as const;
export type SidebarSide = (typeof SIDEBAR_SIDE)[keyof typeof SIDEBAR_SIDE];

export interface Settings {
  appearance: Appearance;
  lightThemeId: string;
  darkThemeId: string;
  customThemes: Theme[];
  /** Font names (like "SF Mono"); the CSS fallbacks are added when the font is applied. */
  editorFont: string;
  previewFont: string;
  fontSize: number;
  lineHeight: number;
  tabSize: number;
  isWordWrapEnabled: boolean;
  showLineNumbers: boolean;
  highlightActiveLine: boolean;
  showInvisibles: boolean;
  isTypewriterScrolling: boolean;
  isFocusMode: boolean;
  /** Widest text column in Plain view, in characters. 0 means as wide as the window. */
  maximumLineWidth: number;
  /** Widest Markdown column in Formatted view, in pixels. 0 means as wide as the window. */
  previewWidth: number;
  trimTrailingWhitespace: boolean;
  insertFinalNewline: boolean;
  defaultViewMode: Record<FormattableKind, ViewMode>;
  csvFirstRowIsHeader: boolean;
  sidebarSide: SidebarSide;
  showHiddenFiles: boolean;
  reopenWindowsOnLaunch: boolean;
  /** Menu shortcuts changed in Settings, by command id (like "view.wordWrap"). An empty string means no shortcut. */
  shortcuts: Record<string, string>;
}

export const MINIMUM_FONT_SIZE = 9;
export const MAXIMUM_FONT_SIZE = 40;
export const MAXIMUM_LINE_WIDTH = 200;
export const MAXIMUM_PREVIEW_WIDTH = 4000;

/** Allowed range of each number typed into Settings. */
export const NUMBER_SETTING_RANGE = {
  fontSize: { minimum: MINIMUM_FONT_SIZE, maximum: MAXIMUM_FONT_SIZE },
  lineHeight: { minimum: 1, maximum: 3 },
  tabSize: { minimum: 1, maximum: 8 },
} as const;
export type NumberSettingKey = keyof typeof NUMBER_SETTING_RANGE;

export const DEFAULT_SETTINGS: Settings = {
  appearance: APPEARANCE.system,
  lightThemeId: DEFAULT_LIGHT_THEME_ID,
  darkThemeId: DEFAULT_DARK_THEME_ID,
  customThemes: [],
  editorFont: DEFAULT_EDITOR_FONT,
  previewFont: DEFAULT_PREVIEW_FONT,
  fontSize: 14,
  lineHeight: 1.6,
  tabSize: 2,
  isWordWrapEnabled: true,
  showLineNumbers: true,
  highlightActiveLine: true,
  showInvisibles: false,
  isTypewriterScrolling: false,
  isFocusMode: false,
  maximumLineWidth: 0,
  previewWidth: 1000,
  trimTrailingWhitespace: false,
  insertFinalNewline: false,
  defaultViewMode: {
    markdown: VIEW_MODE.formatted,
    json: VIEW_MODE.formatted,
    csv: VIEW_MODE.formatted,
    yaml: VIEW_MODE.formatted,
    xml: VIEW_MODE.formatted,
  },
  csvFirstRowIsHeader: true,
  sidebarSide: SIDEBAR_SIDE.left,
  showHiddenFiles: false,
  reopenWindowsOnLaunch: true,
  shortcuts: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readNumber(source: Record<string, unknown>, key: string, fallback: number, minimum: number, maximum: number): number {
  const value = source[key];
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function readBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  return typeof value === 'boolean' ? value : fallback;
}

function readStringRecord(source: Record<string, unknown>, key: string): Record<string, string> {
  const value = source[key];
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return Object.fromEntries(entries);
}

function readOneOf<T extends string>(source: Record<string, unknown>, key: string, options: readonly T[], fallback: T): T {
  const value = source[key];
  return options.find((option) => option === value) ?? fallback;
}

/** Reads a font name, falling back to the full CSS stack older versions stored under `legacyKey`. */
function readFontName(source: Record<string, unknown>, key: string, legacyKey: string, role: 'editor' | 'preview', fallback: string): string {
  const name = source[key];
  if (typeof name === 'string' && name.trim().length > 0) return name.trim();
  const legacyStack = source[legacyKey];
  if (typeof legacyStack === 'string' && legacyStack.trim().length > 0) return fontNameFromLegacyStack(role, legacyStack);
  return fallback;
}

const VIEW_MODES = Object.values(VIEW_MODE);
const THEME_COLOR_KEYS = Object.keys(THEME_COLOR_LABELS).filter((key): key is keyof ThemeColors => key in THEME_COLOR_LABELS);

function getBuiltInFallbackTheme(isDark: boolean): Theme {
  const fallbackId = isDark ? DEFAULT_DARK_THEME_ID : DEFAULT_LIGHT_THEME_ID;
  return BUILT_IN_THEMES.find((theme) => theme.id === fallbackId) ?? BUILT_IN_THEMES[0];
}

function readTheme(value: unknown): Theme | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.colors)) return null;
  const storedColors = value.colors;
  const fallbackColors = getBuiltInFallbackTheme(value.isDark === true).colors;
  const colors = { ...fallbackColors };
  for (const key of THEME_COLOR_KEYS) colors[key] = readString(storedColors, key, fallbackColors[key]);
  return {
    id: value.id,
    name: readString(value, 'name', 'Custom'),
    isDark: value.isDark === true,
    colors,
  };
}

/** Builds valid settings from whatever was stored on disk, falling back to defaults for anything missing or invalid. */
export function mergeSettings(stored: unknown): Settings {
  if (!isRecord(stored)) return DEFAULT_SETTINGS;
  const storedViewModes = isRecord(stored.defaultViewMode) ? stored.defaultViewMode : {};
  const customThemes = Array.isArray(stored.customThemes)
    ? stored.customThemes.map(readTheme).filter((theme) => theme !== null)
    : [];

  return {
    appearance: readOneOf(stored, 'appearance', Object.values(APPEARANCE), DEFAULT_SETTINGS.appearance),
    lightThemeId: readString(stored, 'lightThemeId', DEFAULT_SETTINGS.lightThemeId),
    darkThemeId: readString(stored, 'darkThemeId', DEFAULT_SETTINGS.darkThemeId),
    customThemes,
    editorFont: readFontName(stored, 'editorFont', 'editorFontFamily', FONT_ROLE.editor, DEFAULT_SETTINGS.editorFont),
    previewFont: readFontName(stored, 'previewFont', 'previewFontFamily', FONT_ROLE.preview, DEFAULT_SETTINGS.previewFont),
    fontSize: readNumber(stored, 'fontSize', DEFAULT_SETTINGS.fontSize, NUMBER_SETTING_RANGE.fontSize.minimum, NUMBER_SETTING_RANGE.fontSize.maximum),
    lineHeight: readNumber(stored, 'lineHeight', DEFAULT_SETTINGS.lineHeight, NUMBER_SETTING_RANGE.lineHeight.minimum, NUMBER_SETTING_RANGE.lineHeight.maximum),
    tabSize: readNumber(stored, 'tabSize', DEFAULT_SETTINGS.tabSize, NUMBER_SETTING_RANGE.tabSize.minimum, NUMBER_SETTING_RANGE.tabSize.maximum),
    isWordWrapEnabled: readBoolean(stored, 'isWordWrapEnabled', DEFAULT_SETTINGS.isWordWrapEnabled),
    showLineNumbers: readBoolean(stored, 'showLineNumbers', DEFAULT_SETTINGS.showLineNumbers),
    highlightActiveLine: readBoolean(stored, 'highlightActiveLine', DEFAULT_SETTINGS.highlightActiveLine),
    showInvisibles: readBoolean(stored, 'showInvisibles', DEFAULT_SETTINGS.showInvisibles),
    isTypewriterScrolling: readBoolean(stored, 'isTypewriterScrolling', DEFAULT_SETTINGS.isTypewriterScrolling),
    isFocusMode: readBoolean(stored, 'isFocusMode', DEFAULT_SETTINGS.isFocusMode),
    maximumLineWidth: readNumber(stored, 'maximumLineWidth', DEFAULT_SETTINGS.maximumLineWidth, 0, MAXIMUM_LINE_WIDTH),
    previewWidth: readNumber(stored, 'previewWidth', DEFAULT_SETTINGS.previewWidth, 0, MAXIMUM_PREVIEW_WIDTH),
    trimTrailingWhitespace: readBoolean(stored, 'trimTrailingWhitespace', DEFAULT_SETTINGS.trimTrailingWhitespace),
    insertFinalNewline: readBoolean(stored, 'insertFinalNewline', DEFAULT_SETTINGS.insertFinalNewline),
    defaultViewMode: {
      markdown: readOneOf(storedViewModes, 'markdown', VIEW_MODES, DEFAULT_SETTINGS.defaultViewMode.markdown),
      json: readOneOf(storedViewModes, 'json', VIEW_MODES, DEFAULT_SETTINGS.defaultViewMode.json),
      csv: readOneOf(storedViewModes, 'csv', VIEW_MODES, DEFAULT_SETTINGS.defaultViewMode.csv),
      yaml: readOneOf(storedViewModes, 'yaml', VIEW_MODES, DEFAULT_SETTINGS.defaultViewMode.yaml),
      xml: readOneOf(storedViewModes, 'xml', VIEW_MODES, DEFAULT_SETTINGS.defaultViewMode.xml),
    },
    csvFirstRowIsHeader: readBoolean(stored, 'csvFirstRowIsHeader', DEFAULT_SETTINGS.csvFirstRowIsHeader),
    sidebarSide: readOneOf(stored, 'sidebarSide', Object.values(SIDEBAR_SIDE), DEFAULT_SETTINGS.sidebarSide),
    showHiddenFiles: readBoolean(stored, 'showHiddenFiles', DEFAULT_SETTINGS.showHiddenFiles),
    reopenWindowsOnLaunch: readBoolean(stored, 'reopenWindowsOnLaunch', DEFAULT_SETTINGS.reopenWindowsOnLaunch),
    shortcuts: readStringRecord(stored, 'shortcuts'),
  };
}

/** All themes the user can pick from: built-in presets followed by their custom themes. */
export function getAllThemes(settings: Settings): Theme[] {
  return [...BUILT_IN_THEMES, ...settings.customThemes];
}

/** Picks the theme to show for the current appearance, falling back to a built-in theme if the stored id is gone. */
export function resolveActiveTheme(settings: Settings, systemPrefersDark: boolean): Theme {
  const isDark = settings.appearance === APPEARANCE.system ? systemPrefersDark : settings.appearance === APPEARANCE.dark;
  const themeId = isDark ? settings.darkThemeId : settings.lightThemeId;
  return getAllThemes(settings).find((theme) => theme.id === themeId) ?? getBuiltInFallbackTheme(isDark);
}

export function isBuiltInTheme(themeId: string): boolean {
  return BUILT_IN_THEMES.some((theme) => theme.id === themeId);
}

/**
 * The settings changes that save an edited custom theme. When the theme moves between light and dark,
 * it takes over the new slot (so you keep seeing it) and the old slot falls back to the default theme.
 */
export function saveCustomTheme(settings: Settings, updatedTheme: Theme): Partial<Settings> {
  const customThemes = settings.customThemes.map((theme) => (theme.id === updatedTheme.id ? updatedTheme : theme));
  const changes: Partial<Settings> = { customThemes };
  if (updatedTheme.isDark && settings.lightThemeId === updatedTheme.id) {
    changes.lightThemeId = DEFAULT_LIGHT_THEME_ID;
    changes.darkThemeId = updatedTheme.id;
  }
  if (!updatedTheme.isDark && settings.darkThemeId === updatedTheme.id) {
    changes.darkThemeId = DEFAULT_DARK_THEME_ID;
    changes.lightThemeId = updatedTheme.id;
  }
  return changes;
}

/** The settings changes that delete a custom theme. A slot that used it goes back to the default theme. */
export function deleteCustomTheme(settings: Settings, themeId: string): Partial<Settings> {
  const changes: Partial<Settings> = { customThemes: settings.customThemes.filter((theme) => theme.id !== themeId) };
  if (settings.lightThemeId === themeId) changes.lightThemeId = DEFAULT_LIGHT_THEME_ID;
  if (settings.darkThemeId === themeId) changes.darkThemeId = DEFAULT_DARK_THEME_ID;
  return changes;
}
