import { expect, test } from 'bun:test';

import { formatShortcut, isOptionCharacterShortcut, normalizeShortcut, shortcutFromKeyPress } from './shortcut-keys';

const NO_MODIFIERS = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };

test('spells the same keys the same way, whatever order or names were used', () => {
  expect(normalizeShortcut('CmdOrCtrl+Shift+K')).toBe('Shift+CmdOrCtrl+K');
  expect(normalizeShortcut('shift+cmd+k')).toBe('Shift+CmdOrCtrl+K');
  expect(normalizeShortcut('CmdOrCtrl+0')).toBe('CmdOrCtrl+Digit0');
  expect(normalizeShortcut('Alt+Up')).toBe('Alt+ArrowUp');
  expect(normalizeShortcut('CmdOrCtrl+Banana')).toBeNull();
  expect(normalizeShortcut('Hyper+K')).toBeNull();
});

test('reads a key press by physical key, so ⌥Z is Z and not Ω', () => {
  expect(shortcutFromKeyPress({ ...NO_MODIFIERS, code: 'KeyZ', altKey: true }, true)).toBe('Alt+Z');
  expect(shortcutFromKeyPress({ ...NO_MODIFIERS, code: 'Digit1', metaKey: true }, true)).toBe('CmdOrCtrl+Digit1');
  expect(shortcutFromKeyPress({ ...NO_MODIFIERS, code: 'Enter', metaKey: true, shiftKey: true }, true)).toBe('Shift+CmdOrCtrl+Enter');
  expect(shortcutFromKeyPress({ ...NO_MODIFIERS, code: 'KeyK', ctrlKey: true }, false)).toBe('CmdOrCtrl+K');
});

test('ignores lone modifiers and plain typing', () => {
  expect(shortcutFromKeyPress({ ...NO_MODIFIERS, code: 'ShiftLeft', shiftKey: true }, true)).toBeNull();
  expect(shortcutFromKeyPress({ ...NO_MODIFIERS, code: 'KeyA' }, true)).toBeNull();
  expect(shortcutFromKeyPress({ ...NO_MODIFIERS, code: 'KeyA', shiftKey: true }, true)).toBeNull();
  expect(shortcutFromKeyPress({ ...NO_MODIFIERS, code: 'F5' }, true)).toBe('F5');
});

test('shows shortcuts with Mac symbols, or spelled out elsewhere', () => {
  expect(formatShortcut('CmdOrCtrl+Shift+K', true)).toBe('⇧⌘K');
  expect(formatShortcut('Alt+ArrowUp', true)).toBe('⌥↑');
  expect(formatShortcut('CmdOrCtrl+Digit0', true)).toBe('⌘0');
  expect(formatShortcut('CmdOrCtrl+Shift+K', false)).toBe('Ctrl+Shift+K');
});

test('finds ⌥ shortcuts that would type a character', () => {
  expect(isOptionCharacterShortcut('Alt+Z')).toBe(true);
  expect(isOptionCharacterShortcut('Alt+Shift+F')).toBe(true);
  expect(isOptionCharacterShortcut('Alt+ArrowUp')).toBe(false);
  expect(isOptionCharacterShortcut('Alt+CmdOrCtrl+F')).toBe(false);
});
