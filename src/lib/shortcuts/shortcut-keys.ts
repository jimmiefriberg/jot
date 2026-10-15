// Shortcuts are stored in Tauri's accelerator format ("CmdOrCtrl+Shift+K"), the same one the native menu reads.

/** The parts of a key press a shortcut is made from. */
export interface ShortcutKeyPress {
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'CmdOrCtrl'] as const;
type Modifier = (typeof MODIFIER_ORDER)[number];

const MODIFIER_ALIASES: Record<string, Modifier> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  cmdorctrl: 'CmdOrCtrl',
  commandorcontrol: 'CmdOrCtrl',
  cmd: 'CmdOrCtrl',
  command: 'CmdOrCtrl',
  super: 'CmdOrCtrl',
  meta: 'CmdOrCtrl',
};

const KEY_ALIASES: Record<string, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  return: 'Enter',
  esc: 'Escape',
  plus: 'Equal',
  '=': 'Equal',
  '-': 'Minus',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  '\\': 'Backslash',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  ';': 'Semicolon',
  "'": 'Quote',
  '`': 'Backquote',
};

const MAC_MODIFIER_SYMBOLS: Record<Modifier, string> = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', CmdOrCtrl: '⌘' };
const OTHER_MODIFIER_ORDER: Modifier[] = ['CmdOrCtrl', 'Ctrl', 'Alt', 'Shift'];
const OTHER_MODIFIER_NAMES: Record<Modifier, string> = { Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', CmdOrCtrl: 'Ctrl' };

const KEY_SYMBOLS: Record<string, string> = {
  Enter: '↩',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
  Delete: '⌦',
  Tab: '⇥',
  Escape: '⎋',
  Space: 'Space',
  Equal: '=',
  Minus: '-',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
};

// Keys that type a character. With only ⌥ held they type a symbol (⌥Z is Ω) before the menu sees them.
const CHARACTER_KEY = /^(?:[A-Z]|Digit\d|Equal|Minus|Comma|Period|Slash|Backslash|BracketLeft|BracketRight|Semicolon|Quote|Backquote)$/;
const NAMED_KEY = /^(?:Enter|Tab|Space|Backspace|Delete|Escape|Home|End|PageUp|PageDown|Arrow(?:Up|Down|Left|Right)|F\d{1,2})$/;
const FUNCTION_KEY = /^F\d{1,2}$/;

function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
}

/** "z" or "KeyZ" → "Z", "1" or "Digit1" → "Digit1", "up" → "ArrowUp". Null when it isn't a key a shortcut can use. */
function normalizeKey(key: string): string | null {
  const aliased = KEY_ALIASES[key.toLowerCase()] ?? KEY_ALIASES[key] ?? key;
  if (/^Key[A-Z]$/i.test(aliased)) return aliased.slice(3).toUpperCase();
  if (/^[a-z]$/i.test(aliased)) return aliased.toUpperCase();
  if (/^\d$/.test(aliased)) return `Digit${aliased}`;
  const named = aliased.charAt(0).toUpperCase() + aliased.slice(1);
  return CHARACTER_KEY.test(named) || NAMED_KEY.test(named) ? named : null;
}

/** One spelling per shortcut ("cmd+shift+k" → "Shift+CmdOrCtrl+K"), so two shortcuts compare equal when they're the same keys. */
export function normalizeShortcut(shortcut: string): string | null {
  const parts = shortcut.split('+').map((part) => part.trim());
  const keyPart = parts.pop();
  if (!keyPart) return null;
  const key = normalizeKey(keyPart);
  if (!key) return null;
  const modifiers = new Set<Modifier>();
  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (!modifier) return null;
    modifiers.add(modifier);
  }
  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+');
}

/** The shortcut a key press makes, or null for a lone modifier or a plain key (shortcuts need ⌘, ⌃ or ⌥, except F-keys). */
export function shortcutFromKeyPress(keyPress: ShortcutKeyPress, isMac = isMacPlatform()): string | null {
  const key = normalizeKey(keyPress.code);
  if (!key) return null;
  const modifiers = new Set<Modifier>();
  if (isMac) {
    if (keyPress.metaKey) modifiers.add('CmdOrCtrl');
    if (keyPress.ctrlKey) modifiers.add('Ctrl');
  } else if (keyPress.ctrlKey) {
    modifiers.add('CmdOrCtrl');
  }
  if (keyPress.altKey) modifiers.add('Alt');
  if (keyPress.shiftKey) modifiers.add('Shift');
  const hasCommandModifier = modifiers.has('CmdOrCtrl') || modifiers.has('Ctrl') || modifiers.has('Alt');
  if (!hasCommandModifier && !FUNCTION_KEY.test(key)) return null;
  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+');
}

/** Whether a shortcut is ⌥ (and maybe ⇧) plus a key that types a character, which the editor would otherwise type. */
export function isOptionCharacterShortcut(shortcut: string): boolean {
  const parts = shortcut.split('+');
  const key = parts.at(-1) ?? '';
  return parts.includes('Alt') && !parts.includes('CmdOrCtrl') && !parts.includes('Ctrl') && CHARACTER_KEY.test(key);
}

/** "Shift+CmdOrCtrl+K" → "⇧⌘K" on a Mac, "Ctrl+Shift+K" elsewhere. */
export function formatShortcut(shortcut: string, isMac = isMacPlatform()): string {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return shortcut;
  const parts = normalized.split('+');
  const key = parts.pop() ?? '';
  const keyLabel = KEY_SYMBOLS[key] ?? key.replace(/^Digit/, '');
  const modifiers = parts.filter((part): part is Modifier => MODIFIER_ORDER.some((modifier) => modifier === part));
  if (isMac) return modifiers.map((modifier) => MAC_MODIFIER_SYMBOLS[modifier]).join('') + keyLabel;
  // Elsewhere ⌘ is Ctrl and comes first, so a shortcut with both shows Ctrl once.
  const names = [...new Set(OTHER_MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier)).map((modifier) => OTHER_MODIFIER_NAMES[modifier]))];
  return [...names, keyLabel].join('+');
}
