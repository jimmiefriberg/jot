import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { FILE_KIND, FILE_KIND_LABEL, VIEW_MODE } from '../lib/documents/file-kind';
import type { FormattableKind, ViewMode } from '../lib/documents/file-kind';
import { FONT_ROLE } from '../lib/settings/fonts';
import { APPEARANCE, NUMBER_SETTING_RANGE, SIDEBAR_SIDE, getAllThemes } from '../lib/settings/settings-schema';
import type { Appearance, NumberSettingKey, Settings, SidebarSide } from '../lib/settings/settings-schema';
import { flushSettings, loadSettings, updateSettings, useActiveTheme, useSettingsStore } from '../lib/settings/settings-store';
import { useSettingsSync } from '../lib/settings/use-settings-sync';
import { handleCloseRequests, listenForMenuActions } from '../lib/tauri/backend';
import { useShowWindowWhenReady } from './use-editor-window';
import { Icon } from '../components/Icon/Icon';
import type { IconName } from '../components/Icon/Icon';
import { FontPicker } from '../components/Settings/FontPicker';
import { handleChoiceGroupKeyDown } from '../components/Settings/choice-group-keys';
import { NumberInput, Segmented, SettingGroup, SettingRow, SwitchRow } from '../components/Settings/SettingRow';
import { ShortcutSettings } from '../components/Settings/ShortcutSettings';
import { ThemeEditor } from '../components/Settings/ThemeEditor';
import { ThemeGrid } from '../components/Settings/ThemeGrid';

const SETTINGS_TAB = { general: 'general', themes: 'themes', editor: 'editor', files: 'files', shortcuts: 'shortcuts' } as const;
type SettingsTab = (typeof SETTINGS_TAB)[keyof typeof SETTINGS_TAB];

const TABS: { tab: SettingsTab; label: string; icon: IconName }[] = [
  { tab: SETTINGS_TAB.general, label: 'General', icon: 'sliders' },
  { tab: SETTINGS_TAB.themes, label: 'Themes', icon: 'palette' },
  { tab: SETTINGS_TAB.editor, label: 'Editor', icon: 'text' },
  { tab: SETTINGS_TAB.files, label: 'Files', icon: 'folder' },
  { tab: SETTINGS_TAB.shortcuts, label: 'Shortcuts', icon: 'keyboard' },
];

const TAB_STORAGE_KEY = 'settings-tab';
const FORMATTABLE_KINDS: FormattableKind[] = ['markdown', 'json', 'jsonLines', 'csv', 'yaml', 'xml', 'html'];
const LINE_WIDTH_OPTIONS = [0, 60, 72, 80, 100, 120];

const PREVIEW_WIDTH_OPTIONS: { value: number; label: string }[] = [
  { value: 760, label: 'Narrow' },
  { value: 1000, label: 'Wide' },
  { value: 1280, label: 'Extra wide' },
  { value: 0, label: 'Full window' },
];

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: APPEARANCE.system, label: 'Match system' },
  { value: APPEARANCE.light, label: 'Light' },
  { value: APPEARANCE.dark, label: 'Dark' },
];

const SIDEBAR_OPTIONS: { value: SidebarSide; label: string }[] = [
  { value: SIDEBAR_SIDE.left, label: 'Left' },
  { value: SIDEBAR_SIDE.right, label: 'Right' },
];

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: VIEW_MODE.formatted, label: 'Formatted' },
  { value: VIEW_MODE.plain, label: 'Plain' },
];

const MARKDOWN_VIEW_MODE_OPTIONS = [...VIEW_MODE_OPTIONS, { value: VIEW_MODE.sideBySide, label: 'Side by Side' }];

function isSettingsTab(value: unknown): value is SettingsTab {
  return Object.values(SETTINGS_TAB).some((tab) => tab === value);
}

function readStoredTab(): SettingsTab {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    return isSettingsTab(stored) ? stored : SETTINGS_TAB.general;
  } catch {
    return SETTINGS_TAB.general;
  }
}

function storeTab(tab: SettingsTab) {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // Storage can be unavailable; the window then opens on General next time.
  }
}

/** Creates a handler that saves one yes/no setting. */
function saveSwitch(key: keyof Settings) {
  return function handleSwitchChange(isChecked: boolean) {
    updateSettings({ [key]: isChecked });
  };
}

/** Creates a handler that saves one number setting (the field only passes values in range). */
function saveNumber(key: NumberSettingKey) {
  return function handleNumberChange(value: number) {
    updateSettings({ [key]: value });
  };
}

// The native Edit menu sends undo/redo as menu actions; in this window they go to the focused text field.
function handleSettingsMenuAction(actionId: string) {
  if (actionId === 'edit.undo') document.execCommand('undo');
  if (actionId === 'edit.redo') document.execCommand('redo');
}

async function saveBeforeClosing(): Promise<boolean> {
  await flushSettings();
  return true;
}

function useSettingsWindowSetup() {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    let isCancelled = false;
    async function load() {
      await loadSettings();
      if (!isCancelled) setIsReady(true);
    }
    void load();
    return () => {
      isCancelled = true;
    };
  }, []);
  useEffect(() => listenForMenuActions(handleSettingsMenuAction), []);
  useEffect(() => handleCloseRequests(saveBeforeClosing), []);
  return isReady;
}

function handleAppearanceChange(appearance: Appearance) {
  updateSettings({ appearance });
}

function handleSidebarSideChange(sidebarSide: SidebarSide) {
  updateSettings({ sidebarSide });
}

function GeneralTab() {
  const settings = useSettingsStore((state) => state.settings);
  return (
    <>
      <SettingGroup title="Appearance">
        <SettingRow label="Light or dark" description="Pick the theme for each one in Themes.">
          <Segmented label="Light or dark" value={settings.appearance} options={APPEARANCE_OPTIONS} onChange={handleAppearanceChange} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="Windows">
        <SwitchRow
          label="Reopen windows from last time"
          description="Files and folders that were open when you quit come back at launch."
          isChecked={settings.reopenWindowsOnLaunch}
          onChange={saveSwitch('reopenWindowsOnLaunch')}
        />
        <SettingRow label="Sidebar position">
          <Segmented label="Sidebar position" value={settings.sidebarSide} options={SIDEBAR_OPTIONS} onChange={handleSidebarSideChange} />
        </SettingRow>
      </SettingGroup>
    </>
  );
}

function handleLightThemeSelect(lightThemeId: string) {
  updateSettings({ lightThemeId });
}

function handleDarkThemeSelect(darkThemeId: string) {
  updateSettings({ darkThemeId });
}

/** When a light or dark theme is used, given the appearance setting. */
function describeThemeUsage(isDark: boolean, appearance: Appearance): string {
  const mode = isDark ? 'dark' : 'light';
  if (appearance === APPEARANCE.system) return `Used while your system is in ${mode} mode.`;
  const isUsed = (appearance === APPEARANCE.dark) === isDark;
  return isUsed ? 'Used in every window.' : `Not used while ${isDark ? 'Light' : 'Dark'} is chosen above.`;
}

interface ThemeSectionProps {
  isDark: boolean;
  activeThemeId: string;
  onSelect: (themeId: string) => void;
  onCustomize: (themeId: string) => void;
}

/** The light or dark theme picker, with a line saying when its theme is used. */
function ThemeSection({ isDark, activeThemeId, onSelect, onCustomize }: ThemeSectionProps) {
  const settings = useSettingsStore((state) => state.settings);
  const themes = getAllThemes(settings).filter((theme) => theme.isDark === isDark);
  const selectedThemeId = isDark ? settings.darkThemeId : settings.lightThemeId;

  function handleCustomize() {
    onCustomize(selectedThemeId);
  }

  return (
    <section className="setting-group">
      <div className="theme-section-header">
        <div className="theme-section-title">
          <h2>{isDark ? 'Dark theme' : 'Light theme'}</h2>
          <span className="theme-section-usage">{describeThemeUsage(isDark, settings.appearance)}</span>
        </div>
        <button className="theme-section-customize" onClick={handleCustomize}>
          Customize colours…
        </button>
      </div>
      <ThemeGrid themes={themes} selectedThemeId={selectedThemeId} activeThemeId={activeThemeId} onSelect={onSelect} />
    </section>
  );
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function ThemesTab() {
  const settings = useSettingsStore((state) => state.settings);
  const activeTheme = useActiveTheme();
  const [editedThemeId, setEditedThemeId] = useState<string | null>(null);
  const customizeReference = useRef<HTMLDetailsElement>(null);

  // Opens the colour editor on that theme and brings it into view, so editing doesn't mean scrolling past every card.
  function handleCustomize(themeId: string) {
    setEditedThemeId(themeId);
    const details = customizeReference.current;
    if (!details) return;
    details.open = true;
    details.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
    details.querySelector('summary')?.focus({ preventScroll: true });
  }

  return (
    <>
      <SettingGroup title="Appearance">
        <SettingRow label="Light or dark">
          <Segmented label="Light or dark" value={settings.appearance} options={APPEARANCE_OPTIONS} onChange={handleAppearanceChange} />
        </SettingRow>
      </SettingGroup>
      <ThemeSection isDark={false} activeThemeId={activeTheme.id} onSelect={handleLightThemeSelect} onCustomize={handleCustomize} />
      <ThemeSection isDark activeThemeId={activeTheme.id} onSelect={handleDarkThemeSelect} onCustomize={handleCustomize} />
      <details ref={customizeReference} className="setting-group theme-customize">
        <summary>
          <h2>Customize colours</h2>
        </summary>
        <ThemeEditor themeId={editedThemeId ?? activeTheme.id} onSelectTheme={setEditedThemeId} />
      </details>
    </>
  );
}

function handleEditorFontChange(editorFont: string) {
  updateSettings({ editorFont });
}

function handlePreviewFontChange(previewFont: string) {
  updateSettings({ previewFont });
}

function handleLineWidthChange(event: ChangeEvent<HTMLSelectElement>) {
  updateSettings({ maximumLineWidth: Number(event.target.value) });
}

function handlePreviewWidthChange(event: ChangeEvent<HTMLSelectElement>) {
  updateSettings({ previewWidth: Number(event.target.value) });
}

function EditorTab() {
  const settings = useSettingsStore((state) => state.settings);
  return (
    <>
      <SettingGroup title="Fonts">
        <SettingRow label="Editor font" description="Plain text, code and data.">
          <FontPicker role={FONT_ROLE.editor} label="Editor font" fontName={settings.editorFont} onChange={handleEditorFontChange} />
        </SettingRow>
        <SettingRow label="Writing font" description="Markdown when formatted.">
          <FontPicker role={FONT_ROLE.preview} label="Writing font" fontName={settings.previewFont} onChange={handlePreviewFontChange} />
        </SettingRow>
        <SettingRow label="Font size" description="⌘+ and ⌘− zoom a single window.">
          <NumberInput value={settings.fontSize} {...NUMBER_SETTING_RANGE.fontSize} onChange={saveNumber('fontSize')} />
        </SettingRow>
        <SettingRow label="Line height">
          <NumberInput value={settings.lineHeight} {...NUMBER_SETTING_RANGE.lineHeight} step={0.1} onChange={saveNumber('lineHeight')} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="Layout">
        <SwitchRow label="Wrap long lines" isChecked={settings.isWordWrapEnabled} onChange={saveSwitch('isWordWrapEnabled')} />
        <SettingRow label="Text width" description="Narrows Plain view to a comfortable reading column.">
          <select value={settings.maximumLineWidth} onChange={handleLineWidthChange} aria-label="Text width">
            {LINE_WIDTH_OPTIONS.map((width) => (
              <option key={width} value={width}>
                {width === 0 ? 'Full window' : `${width} characters`}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Markdown width" description="How wide formatted Markdown can get.">
          <select value={settings.previewWidth} onChange={handlePreviewWidthChange} aria-label="Markdown width">
            {PREVIEW_WIDTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Tab size">
          <NumberInput value={settings.tabSize} {...NUMBER_SETTING_RANGE.tabSize} onChange={saveNumber('tabSize')} />
        </SettingRow>
        <SwitchRow label="Show line numbers" isChecked={settings.showLineNumbers} onChange={saveSwitch('showLineNumbers')} />
        <SwitchRow label="Highlight the current line" isChecked={settings.highlightActiveLine} onChange={saveSwitch('highlightActiveLine')} />
        <SwitchRow label="Show invisible characters" description="Spaces and tabs." isChecked={settings.showInvisibles} onChange={saveSwitch('showInvisibles')} />
      </SettingGroup>
      <SettingGroup title="Writing">
        <SwitchRow
          label="Typewriter scrolling"
          description="Keeps the line you're typing in the middle of the window."
          isChecked={settings.isTypewriterScrolling}
          onChange={saveSwitch('isTypewriterScrolling')}
        />
        <SwitchRow
          label="Focus mode"
          description="Fades everything except the paragraph you're writing."
          isChecked={settings.isFocusMode}
          onChange={saveSwitch('isFocusMode')}
        />
      </SettingGroup>
    </>
  );
}

interface DefaultViewRowProps {
  kind: FormattableKind;
  viewMode: ViewMode;
}

function DefaultViewRow({ kind, viewMode }: DefaultViewRowProps) {
  function handleChange(nextViewMode: ViewMode) {
    const { defaultViewMode } = useSettingsStore.getState().settings;
    updateSettings({ defaultViewMode: { ...defaultViewMode, [kind]: nextViewMode } });
  }

  return (
    <SettingRow label={`${FILE_KIND_LABEL[kind]} opens as`}>
      <Segmented
        label={`${FILE_KIND_LABEL[kind]} opens as`}
        value={viewMode}
        options={kind === FILE_KIND.markdown ? MARKDOWN_VIEW_MODE_OPTIONS : VIEW_MODE_OPTIONS}
        onChange={handleChange}
      />
    </SettingRow>
  );
}

function FilesTab() {
  const settings = useSettingsStore((state) => state.settings);
  return (
    <>
      <SettingGroup title="Opening files">
        {FORMATTABLE_KINDS.map((kind) => (
          <DefaultViewRow key={kind} kind={kind} viewMode={settings.defaultViewMode[kind]} />
        ))}
        <SwitchRow label="CSV: first row is a header" isChecked={settings.csvFirstRowIsHeader} onChange={saveSwitch('csvFirstRowIsHeader')} />
      </SettingGroup>
      <SettingGroup title="Saving">
        <SwitchRow
          label="Remove trailing spaces"
          description="Markdown line breaks (two spaces) are kept. CSV is left alone."
          isChecked={settings.trimTrailingWhitespace}
          onChange={saveSwitch('trimTrailingWhitespace')}
        />
        <SwitchRow label="End files with a newline" isChecked={settings.insertFinalNewline} onChange={saveSwitch('insertFinalNewline')} />
      </SettingGroup>
      <SettingGroup title="Sidebar">
        <SwitchRow
          label="Show hidden files"
          description="Files like .env and .gitignore."
          isChecked={settings.showHiddenFiles}
          onChange={saveSwitch('showHiddenFiles')}
        />
      </SettingGroup>
    </>
  );
}

const TAB_CONTENT: Record<SettingsTab, () => React.JSX.Element> = {
  general: GeneralTab,
  themes: ThemesTab,
  editor: EditorTab,
  files: FilesTab,
  shortcuts: ShortcutSettings,
};

interface TabButtonProps {
  tab: SettingsTab;
  label: string;
  icon: IconName;
  isActive: boolean;
  onSelect: (tab: SettingsTab) => void;
}

function TabButton({ tab, label, icon, isActive, onSelect }: TabButtonProps) {
  function handleClick() {
    onSelect(tab);
  }

  return (
    <button role="tab" aria-selected={isActive} tabIndex={isActive ? 0 : -1} className={isActive ? 'is-active' : undefined} onClick={handleClick}>
      <Icon name={icon} size={18} />
      {label}
    </button>
  );
}

/** ⌘1–⌘5 (Ctrl on Linux) switch between the tabs, in the order they're shown. */
function useTabShortcuts(setActiveTab: (tab: SettingsTab) => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const shortcutTab = TABS[Number(event.key) - 1];
      if (!shortcutTab) return;
      event.preventDefault();
      setActiveTab(shortcutTab.tab);
      storeTab(shortcutTab.tab);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  // In the app the native Window menu owns ⌘1–⌘9 and passes them here as "window.selectTab.<number>".
  useEffect(() => {
    function handleMenuAction(actionId: string) {
      const shortcutTab = TABS[Number(actionId.replace('window.selectTab.', '')) - 1];
      if (!actionId.startsWith('window.selectTab.') || !shortcutTab) return;
      setActiveTab(shortcutTab.tab);
      storeTab(shortcutTab.tab);
    }
    return listenForMenuActions(handleMenuAction);
  }, [setActiveTab]);
}

export function SettingsWindow() {
  useSettingsSync();
  const isReady = useSettingsWindowSetup();
  useShowWindowWhenReady(isReady);
  const [activeTab, setActiveTab] = useState<SettingsTab>(readStoredTab);
  useTabShortcuts(setActiveTab);

  function handleSelectTab(tab: SettingsTab) {
    setActiveTab(tab);
    storeTab(tab);
  }

  if (!isReady) return null;
  const TabContent = TAB_CONTENT[activeTab];

  return (
    <div className="settings-window">
      <nav className="settings-tabs" role="tablist" aria-label="Settings" onKeyDown={handleChoiceGroupKeyDown}>
        {TABS.map(({ tab, label, icon }) => (
          <TabButton key={tab} tab={tab} label={label} icon={icon} isActive={tab === activeTab} onSelect={handleSelectTab} />
        ))}
      </nav>
      <div className="settings-content" role="tabpanel">
        <TabContent />
      </div>
    </div>
  );
}
