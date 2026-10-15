import { useEffect } from 'react';

import { handleMenuAction } from '../commands/menu-actions';
import { useSettingsStore } from '../settings/settings-store';
import { resolveShortcut, useMenuCommands } from './menu-shortcuts';
import { isOptionCharacterShortcut, normalizeShortcut, shortcutFromKeyPress } from './shortcut-keys';

/**
 * Runs menu shortcuts like ⌥Z here, because with only ⌥ held the focused editor types a character (Ω)
 * before the native menu gets the key.
 */
export function useOptionKeyShortcuts(): void {
  const { data: commands } = useMenuCommands();
  const overrides = useSettingsStore((state) => state.settings.shortcuts);

  useEffect(() => {
    const commandIdByShortcut = new Map<string, string>();
    for (const command of commands ?? []) {
      const shortcut = resolveShortcut(command, overrides);
      const normalized = shortcut ? normalizeShortcut(shortcut) : null;
      if (normalized && isOptionCharacterShortcut(normalized)) commandIdByShortcut.set(normalized, command.id);
    }
    if (commandIdByShortcut.size === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      const shortcut = shortcutFromKeyPress(event);
      const commandId = shortcut ? commandIdByShortcut.get(shortcut) : undefined;
      if (!commandId) return;
      event.preventDefault();
      event.stopPropagation();
      void handleMenuAction(commandId);
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [commands, overrides]);
}
