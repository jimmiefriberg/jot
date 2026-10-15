import { useState } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';

import type { MenuCommand } from '../../lib/tauri/backend';
import { updateSettings, useSettingsStore } from '../../lib/settings/settings-store';
import { assignShortcut, resolveShortcut, useMenuCommands } from '../../lib/shortcuts/menu-shortcuts';
import { formatShortcut, shortcutFromKeyPress } from '../../lib/shortcuts/shortcut-keys';
import { SettingGroup } from './SettingRow';

interface ShortcutRecorderProps {
  label: string;
  shortcut: string | null;
  onChange: (shortcut: string | null) => void;
}

/** Shows a shortcut; click it, then press the new keys. ⌫ removes the shortcut and ⎋ cancels. */
function ShortcutRecorder({ label, shortcut, onChange }: ShortcutRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // WebKit doesn't focus buttons on click, and the key presses must come here.
    event.currentTarget.focus();
    setIsRecording(true);
  }

  function handleBlur() {
    setIsRecording(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isRecording) return;
    // Every key goes to the recorder, so shortcuts like ⌘S don't also run their command.
    event.preventDefault();
    event.stopPropagation();
    const hasModifier = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
    if (event.key === 'Escape' && !hasModifier) {
      setIsRecording(false);
      return;
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && !hasModifier) {
      setIsRecording(false);
      onChange(null);
      return;
    }
    const pressedShortcut = shortcutFromKeyPress(event.nativeEvent);
    if (!pressedShortcut) return;
    setIsRecording(false);
    onChange(pressedShortcut);
  }

  const buttonText = isRecording ? 'Type shortcut…' : shortcut ? formatShortcut(shortcut) : 'None';
  return (
    <button
      type="button"
      className={`shortcut-recorder${isRecording ? ' is-recording' : ''}${shortcut ? '' : ' is-empty'}`}
      aria-label={`Shortcut for ${label}`}
      onClick={handleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {buttonText}
    </button>
  );
}

interface ShortcutRowProps {
  command: MenuCommand;
  shortcut: string | null;
  isChanged: boolean;
  onChange: (commandId: string, shortcut: string | null) => void;
}

function ShortcutRow({ command, shortcut, isChanged, onChange }: ShortcutRowProps) {
  function handleShortcutChange(nextShortcut: string | null) {
    onChange(command.id, nextShortcut);
  }

  function handleReset() {
    onChange(command.id, command.defaultShortcut);
  }

  return (
    <div className="setting-row shortcut-row">
      <span className="setting-row-label">{command.label}</span>
      <div className="setting-row-control">
        {isChanged && (
          <button type="button" className="shortcut-reset" onClick={handleReset}>
            Reset
          </button>
        )}
        <ShortcutRecorder label={command.label} shortcut={shortcut} onChange={handleShortcutChange} />
      </div>
    </div>
  );
}

/** Commands in menu order, grouped under their menu's name. */
function groupByMenu(commands: MenuCommand[]): [string, MenuCommand[]][] {
  const groups = new Map<string, MenuCommand[]>();
  for (const command of commands) {
    const group = groups.get(command.menu) ?? [];
    group.push(command);
    groups.set(command.menu, group);
  }
  return [...groups];
}

function matchesSearch(command: MenuCommand, search: string): boolean {
  const query = search.trim().toLowerCase();
  return query === '' || command.label.toLowerCase().includes(query) || command.menu.toLowerCase().includes(query);
}

export function ShortcutSettings() {
  const { data: commands = [] } = useMenuCommands();
  const overrides = useSettingsStore((state) => state.settings.shortcuts);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  function handleShortcutChange(commandId: string, shortcut: string | null) {
    const result = assignShortcut(commands, overrides, commandId, shortcut);
    if (!result.isOk) {
      setNotice(result.error);
      return;
    }
    const { replacedLabels } = result.value;
    setNotice(replacedLabels.length > 0 ? `Moved from ${replacedLabels.join(', ')}, which now has no shortcut.` : null);
    updateSettings({ shortcuts: result.value.overrides });
  }

  function handleResetAll() {
    setNotice(null);
    updateSettings({ shortcuts: {} });
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearch(event.target.value);
  }

  const visibleGroups = groupByMenu(commands.filter((command) => matchesSearch(command, search)));
  const hasChanges = Object.keys(overrides).length > 0;

  return (
    <>
      <div className="shortcut-toolbar">
        <input type="search" placeholder="Search commands" aria-label="Search commands" value={search} onChange={handleSearchChange} />
        <button type="button" onClick={handleResetAll} disabled={!hasChanges}>
          Reset All
        </button>
      </div>
      {notice && (
        <p className="settings-hint shortcut-notice" role="status">
          {notice}
        </p>
      )}
      {visibleGroups.map(([menu, menuCommands]) => (
        <SettingGroup key={menu} title={menu}>
          {menuCommands.map((command) => (
            <ShortcutRow
              key={command.id}
              command={command}
              shortcut={resolveShortcut(command, overrides)}
              isChanged={command.id in overrides}
              onChange={handleShortcutChange}
            />
          ))}
        </SettingGroup>
      ))}
      {visibleGroups.length === 0 && <p className="settings-hint shortcut-notice">No commands match “{search}”.</p>}
    </>
  );
}
