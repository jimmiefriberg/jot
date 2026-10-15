import { expect, test } from 'bun:test';

import { assignShortcut, resolveShortcut } from './menu-shortcuts';

const COMMANDS = [
  { id: 'file.save', label: 'Save', menu: 'File', defaultShortcut: 'CmdOrCtrl+S' },
  { id: 'format.link', label: 'Link', menu: 'Format', defaultShortcut: 'CmdOrCtrl+K' },
  { id: 'table.insertRowAbove', label: 'Insert Row Above', menu: 'Table', defaultShortcut: null },
];

test('uses the chosen shortcut, none when cleared, and the default otherwise', () => {
  expect(resolveShortcut(COMMANDS[0], {})).toBe('CmdOrCtrl+S');
  expect(resolveShortcut(COMMANDS[0], { 'file.save': '' })).toBeNull();
  expect(resolveShortcut(COMMANDS[2], { 'table.insertRowAbove': 'Alt+CmdOrCtrl+ArrowUp' })).toBe('Alt+CmdOrCtrl+ArrowUp');
});

test('gives a command a new shortcut', () => {
  const result = assignShortcut(COMMANDS, {}, 'table.insertRowAbove', 'Alt+CmdOrCtrl+ArrowUp');
  expect(result.isOk && result.value).toEqual({ overrides: { 'table.insertRowAbove': 'Alt+CmdOrCtrl+ArrowUp' }, replacedLabels: [] });
});

test('takes the shortcut away from the command that had it', () => {
  const result = assignShortcut(COMMANDS, {}, 'table.insertRowAbove', 'cmd+k');
  expect(result.isOk && result.value).toEqual({
    overrides: { 'format.link': '', 'table.insertRowAbove': 'CmdOrCtrl+K' },
    replacedLabels: ['Link'],
  });
});

test('going back to the default drops the override', () => {
  const result = assignShortcut(COMMANDS, { 'file.save': 'Alt+CmdOrCtrl+S' }, 'file.save', 'CmdOrCtrl+S');
  expect(result.isOk && result.value.overrides).toEqual({});
});

test('removing a shortcut stores an empty one', () => {
  const result = assignShortcut(COMMANDS, {}, 'file.save', null);
  expect(result.isOk && result.value.overrides).toEqual({ 'file.save': '' });
});

test("refuses the system's own shortcuts", () => {
  const result = assignShortcut(COMMANDS, {}, 'file.save', 'CmdOrCtrl+C');
  expect(result.isOk).toBe(false);
});
