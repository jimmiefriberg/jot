import { useQuery } from '@tanstack/react-query';

import { err, ok } from '../result';
import type { Result } from '../result';
import { getMenuCommands } from '../tauri/backend';
import type { MenuCommand } from '../tauri/backend';
import { formatShortcut, normalizeShortcut } from './shortcut-keys';

const MENU_COMMANDS_QUERY_KEY = 'menu-commands';

/** The native menu's commands, with their default shortcuts. They don't change while the app runs. */
export function useMenuCommands() {
  return useQuery({ queryKey: [MENU_COMMANDS_QUERY_KEY], queryFn: getMenuCommands });
}

/** The shortcut a command has now: the one chosen in Settings (empty means none), or its default. */
export function resolveShortcut(command: MenuCommand, overrides: Record<string, string>): string | null {
  const override = overrides[command.id];
  if (override === undefined) return command.defaultShortcut;
  return override === '' ? null : override;
}

// Shortcuts that belong to the system's own menu items (Copy, Paste, Close, Hide…), which can't be changed.
const RESERVED_SHORTCUTS: Record<string, string> = {
  'CmdOrCtrl+C': 'Copy',
  'CmdOrCtrl+V': 'Paste',
  'CmdOrCtrl+X': 'Cut',
  'CmdOrCtrl+A': 'Select All',
  'CmdOrCtrl+H': 'Hide Jot',
  'Alt+CmdOrCtrl+H': 'Hide Others',
  'CmdOrCtrl+M': 'Minimize',
  'Ctrl+CmdOrCtrl+F': 'Enter Full Screen',
};

export interface ShortcutAssignment {
  overrides: Record<string, string>;
  /** Commands that had this shortcut and now have none. */
  replacedLabels: string[];
}

/**
 * Gives a command a shortcut (null removes it). Any other command with the same shortcut loses it,
 * so no two menu items share keys. An override that matches the default is dropped.
 */
export function assignShortcut(
  commands: MenuCommand[],
  overrides: Record<string, string>,
  commandId: string,
  shortcut: string | null,
): Result<ShortcutAssignment> {
  const command = commands.find((candidate) => candidate.id === commandId);
  if (!command) return err('That command is no longer in the menu.');
  const normalized = shortcut ? normalizeShortcut(shortcut) : null;
  if (shortcut && !normalized) return err(`${shortcut} isn't a shortcut the menu can use.`);

  const reservedBy = normalized ? RESERVED_SHORTCUTS[normalized] : undefined;
  if (normalized && reservedBy) return err(`${formatShortcut(normalized)} is used by ${reservedBy}, which can't be changed.`);

  const nextOverrides = { ...overrides };
  const replacedLabels: string[] = [];
  if (normalized) {
    for (const other of commands) {
      if (other.id === commandId) continue;
      const otherShortcut = resolveShortcut(other, overrides);
      if (otherShortcut && normalizeShortcut(otherShortcut) === normalized) {
        nextOverrides[other.id] = '';
        replacedLabels.push(other.label);
      }
    }
  }

  const defaultShortcut = command.defaultShortcut ? normalizeShortcut(command.defaultShortcut) : null;
  if (normalized === defaultShortcut) delete nextOverrides[commandId];
  else nextOverrides[commandId] = normalized ?? '';
  return ok({ overrides: nextOverrides, replacedLabels });
}
