use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, Webview, WebviewUrl, WebviewWindowBuilder, Window};
use tauri_plugin_dialog::DialogExt;

use crate::files::resolve_target_path;
use crate::panes;
use crate::recent;
use crate::session::{self, Draft, SessionWindow};
use crate::tabs;

pub const SETTINGS_WINDOW_LABEL: &str = "settings";
pub(crate) const DOCUMENT_LABEL_PREFIX: &str = "document-";
const FOLDER_OPENED_EVENT: &str = "folder-opened";
const PATH_RENAMED_EVENT: &str = "path-renamed";

#[derive(Default)]
pub struct WindowRegistry {
    pub(crate) state: Mutex<RegistryState>,
}

/// Text a window starts with instead of (or on top of) its file: a recovered draft or a converted document.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartingText {
    text: String,
    /// The draft this text came from, so the window keeps updating (and finally removes) the same draft.
    draft_id: Option<String>,
    /// File kind for untitled documents, like "json" for a conversion.
    kind: Option<String>,
}

/// What a pane shows: its file (if saved), the folder in its sidebar (if any) and any starting text.
/// A window has one pane (its own web view, with the window's label) or two side by side (see `panes`).
#[derive(Default, Clone)]
pub(crate) struct WindowEntry {
    pub(crate) document_path: Option<PathBuf>,
    pub(crate) folder_path: Option<PathBuf>,
    pub(crate) starting_text: Option<StartingText>,
    /// Opens as a window of its own instead of a tab in the front window.
    pub(crate) opens_in_own_window: bool,
    /// The window this pane is in.
    pub(crate) window_label: String,
    /// The title this pane wants; the window shows the title of its active pane.
    pub(crate) title: String,
}

#[derive(Default)]
pub(crate) struct RegistryState {
    /// Every pane, by its web view's label.
    pub(crate) windows: HashMap<String, WindowEntry>,
    /// The panes of each document window, by window label.
    pub(crate) layouts: HashMap<String, panes::Layout>,
    /// Windows (or single panes) that are asking their panes about unsaved changes, by window label.
    pub(crate) closing: HashMap<String, panes::CloseRequest>,
    /// Panes (and the Settings window) whose page answers close requests.
    pub(crate) close_handlers: HashSet<String>,
    pub(crate) next_window_number: u64,
    pub(crate) is_quitting: bool,
    /// Windows still to close during a quit. They close one at a time, so each unsaved-changes prompt stands alone.
    pub(crate) quit_queue: Vec<String>,
    /// Starts Jot again once the quit finishes (after an update is installed).
    pub(crate) restarts_after_quit: bool,
    /// Files whose tab or pane was closed, most recent last, for File → Reopen Closed Tab.
    pub(crate) recently_closed: Vec<ClosedDocument>,
}

/// A closed tab's file and the folder its sidebar showed.
pub(crate) struct ClosedDocument {
    document_path: PathBuf,
    folder_path: Option<PathBuf>,
}

const MAXIMUM_RECENTLY_CLOSED: usize = 20;

/// Remembers a closed pane's file (untitled documents can't be reopened). Quitting doesn't count as closing tabs.
pub(crate) fn remember_closed_pane(state: &mut RegistryState, entry: &WindowEntry) {
    let Some(document_path) = entry.document_path.clone() else { return };
    if state.is_quitting {
        return;
    }
    state.recently_closed.retain(|closed| closed.document_path != document_path);
    state.recently_closed.push(ClosedDocument { document_path, folder_path: entry.folder_path.clone() });
    if state.recently_closed.len() > MAXIMUM_RECENTLY_CLOSED {
        state.recently_closed.remove(0);
    }
}

/// Opens the most recently closed file again, as a tab (skipping files that are open again already or gone).
pub fn reopen_closed_tab<R: Runtime>(app: &AppHandle<R>) {
    let closed = with_registry(app, |state| {
        while let Some(closed) = state.recently_closed.pop() {
            if closed.document_path.exists() && window_showing_document(state, &closed.document_path).is_none() {
                return Some(closed);
            }
        }
        None
    });
    if let Some(closed) = closed {
        let _ = open_document_window(app, Some(closed.document_path), closed.folder_path);
    }
}

/// Runs `action` with the registry locked. Keep it short: never call back into Tauri while holding the lock.
pub(crate) fn with_registry<R: Runtime, T>(app: &AppHandle<R>, action: impl FnOnce(&mut RegistryState) -> T) -> T {
    let registry = app.state::<WindowRegistry>();
    let mut state = registry.state.lock().unwrap();
    action(&mut state)
}

/// A new label for a window or pane.
pub(crate) fn next_document_label(state: &mut RegistryState) -> String {
    state.next_window_number += 1;
    format!("{DOCUMENT_LABEL_PREFIX}{}", state.next_window_number)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentContext {
    path: Option<String>,
    folder_path: Option<String>,
    starting_text: Option<StartingText>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PathRenamed {
    from: String,
    to: String,
}

pub fn is_document_window(label: &str) -> bool {
    label.starts_with(DOCUMENT_LABEL_PREFIX)
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

pub(crate) fn window_title(path: Option<&Path>) -> String {
    path.and_then(|path| path.file_name())
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Untitled".to_string())
}

pub(crate) fn window_showing_document(state: &RegistryState, path: &Path) -> Option<String> {
    state
        .windows
        .iter()
        .find(|(_, entry)| entry.document_path.as_deref() == Some(path))
        .map(|(label, _)| label.clone())
}

/// A window that shows `folder` in its sidebar without a document of its own.
fn window_showing_only_folder(state: &RegistryState, folder: &Path) -> Option<String> {
    state
        .windows
        .iter()
        .find(|(_, entry)| entry.document_path.is_none() && entry.folder_path.as_deref() == Some(folder))
        .map(|(label, _)| label.clone())
}

/// Brings a pane's window (and tab) to the front and puts the keyboard focus in that pane.
pub(crate) fn focus_window<R: Runtime>(app: &AppHandle<R>, pane_label: &str) -> tauri::Result<()> {
    let Some(webview) = app.get_webview(pane_label) else { return Ok(()) };
    let window = webview.window();
    window.unminimize()?;
    window.set_focus()?;
    webview.set_focus()?;
    panes::set_active_pane(app, pane_label);
    Ok(())
}

/// Registers and builds a new (hidden) document window. It shows itself once its content is ready.
fn create_window<R: Runtime>(app: &AppHandle<R>, entry: WindowEntry) -> tauri::Result<()> {
    let has_folder = entry.folder_path.is_some();
    let joins_tabs = !entry.opens_in_own_window;
    let title = window_title(entry.document_path.as_deref().or(entry.folder_path.as_deref()));
    let label = with_registry(app, |state| {
        let label = next_document_label(state);
        state.windows.insert(label.clone(), WindowEntry { window_label: label.clone(), title: title.clone(), ..entry });
        state.layouts.insert(label.clone(), panes::Layout::single(&label));
        label
    });

    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(if has_folder { 1080.0 } else { 860.0 }, 680.0)
        .min_inner_size(360.0, 240.0)
        .visible(false);
    #[cfg(target_os = "macos")]
    let builder = builder.tabbing_identifier("jot-document");

    let window = builder.build()?.as_ref().window();
    // Set before the window first shows, which is when macOS decides whether it becomes a tab.
    app.run_on_main_thread(move || tabs::set_joins_tabs(&window, joins_tabs))?;
    Ok(())
}

/// Opens a file, a folder, or nothing (untitled) as a new tab in the front window.
pub fn open_document_window<R: Runtime>(app: &AppHandle<R>, path: Option<PathBuf>, folder: Option<PathBuf>) -> tauri::Result<()> {
    open_document(app, path, folder, false)
}

/// Like `open_document_window`, but as a window of its own.
pub fn open_document_in_new_window<R: Runtime>(app: &AppHandle<R>, path: Option<PathBuf>, folder: Option<PathBuf>) -> tauri::Result<()> {
    open_document(app, path, folder, true)
}

fn open_document<R: Runtime>(app: &AppHandle<R>, path: Option<PathBuf>, folder: Option<PathBuf>, opens_in_own_window: bool) -> tauri::Result<()> {
    let path = path.map(|path| resolve_target_path(&path));
    let (document_path, folder_path) = match path {
        Some(path) if path.is_dir() => (None, Some(path)),
        other => (other, folder.map(|folder| resolve_target_path(&folder))),
    };

    // A file that's already open, or a folder that's already open on its own, focuses that window instead.
    let existing_label = {
        let registry = app.state::<WindowRegistry>();
        let state = registry.state.lock().unwrap();
        match (document_path.as_deref(), folder_path.as_deref()) {
            (Some(path), _) => window_showing_document(&state, path),
            (None, Some(folder)) => window_showing_only_folder(&state, folder),
            (None, None) => None,
        }
    };
    if let Some(existing_label) = existing_label {
        return focus_window(app, &existing_label);
    }
    if let Some(recent_path) = document_path.as_deref().or(folder_path.as_deref()) {
        recent::note_recent_item(app, recent_path);
    }
    create_window(app, WindowEntry { document_path, folder_path, opens_in_own_window, ..Default::default() })
}

/// Reopens windows for drafts that survived a crash. Returns how many came back.
pub fn recover_drafts<R: Runtime>(app: &AppHandle<R>, drafts: Vec<Draft>) -> usize {
    let mut recovered_count = 0;
    for draft in drafts {
        let document_path = draft.path.as_deref().map(|path| resolve_target_path(Path::new(path)));
        let starting_text = StartingText { text: draft.text, draft_id: Some(draft.id), kind: None };
        if create_window(app, WindowEntry { document_path, starting_text: Some(starting_text), ..Default::default() }).is_ok() {
            recovered_count += 1;
        }
    }
    recovered_count
}

/// Reopens the windows that were open at the last quit, skipping files that are already open.
pub fn restore_session<R: Runtime>(app: &AppHandle<R>) {
    for window in session::load_session(app) {
        let document_path = window.path.as_deref().map(|path| resolve_target_path(Path::new(path)));
        let is_already_open = {
            let registry = app.state::<WindowRegistry>();
            let state = registry.state.lock().unwrap();
            document_path.as_deref().is_some_and(|path| window_showing_document(&state, path).is_some())
        };
        if is_already_open {
            continue;
        }
        let folder_path = window.folder.as_deref().map(|folder| resolve_target_path(Path::new(folder)));
        let _ = create_window(app, WindowEntry { document_path, folder_path, ..Default::default() });
    }
}

/// Shows a folder in an existing pane's sidebar.
fn show_folder_in_window<R: Runtime>(app: &AppHandle<R>, label: &str, folder: &Path) {
    let folder = resolve_target_path(folder);
    if let Some(entry) = app.state::<WindowRegistry>().state.lock().unwrap().windows.get_mut(label) {
        entry.folder_path = Some(folder.clone());
    }
    recent::note_recent_item(app, &folder);
    let _ = app.emit_to(label, FOLDER_OPENED_EVENT, path_to_string(&folder));
}

pub fn open_settings_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
        return window.set_focus();
    }
    WebviewWindowBuilder::new(app, SETTINGS_WINDOW_LABEL, WebviewUrl::App("index.html".into()))
        .title("Settings")
        .inner_size(760.0, 620.0)
        .min_inner_size(620.0, 460.0)
        .visible(false)
        .build()?;
    Ok(())
}

/// Every extension Jot has a view for (the same list as `KIND_BY_EXTENSION` in file-kind.ts), plus plain-text ones.
const OPENABLE_EXTENSIONS: [&str; 25] = [
    "txt", "text", "log", "md", "markdown", "mdown", "json", "jsonc", "json5", "code-workspace", "jsonl", "ndjson", "csv", "tsv",
    "yml", "yaml", "xml", "plist", "svg", "xsd", "xsl", "xslt", "html", "htm", "pdf",
];

pub fn show_open_dialog<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    app.dialog()
        .file()
        .add_filter("Documents", &OPENABLE_EXTENSIONS)
        .add_filter("All files", &["*"])
        .pick_files(move |selected| {
            let Some(selected) = selected else { return };
            for file_path in selected {
                if let Ok(path) = file_path.into_path() {
                    let _ = open_document_window(&app_handle, Some(path), None);
                }
            }
        });
}

fn document_windows<R: Runtime>(app: &AppHandle<R>) -> Vec<Window<R>> {
    app.windows().into_iter().filter(|(label, _)| is_document_window(label)).map(|(_, window)| window).collect()
}

pub fn focused_document_window<R: Runtime>(app: &AppHandle<R>) -> Option<Window<R>> {
    document_windows(app).into_iter().find(|window| window.is_focused().unwrap_or(false))
}

/// Where menu actions go: the active pane of the focused document window, or the focused Settings window.
pub fn focused_menu_target<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    if let Some(window) = focused_document_window(app) {
        return Some(panes::active_pane(app, window.label()));
    }
    app.windows().into_values().find(|window| window.is_focused().unwrap_or(false)).map(|window| window.label().to_string())
}

/// Picks a folder and shows it in the focused window's sidebar, or in a new window when none is focused.
pub fn show_open_folder_dialog<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    let target_label = focused_document_window(app).map(|window| panes::active_pane(app, window.label()));
    app.dialog().file().pick_folder(move |selected| {
        let Some(folder) = selected.and_then(|folder| folder.into_path().ok()) else { return };
        match &target_label {
            Some(label) => show_folder_in_window(&app_handle, label, &folder),
            None => {
                let _ = open_document_window(&app_handle, None, Some(folder));
            }
        }
    });
}

pub fn has_document_windows<R: Runtime>(app: &AppHandle<R>) -> bool {
    !document_windows(app).is_empty()
}

/// Closes the next window in the quit queue (focused first, so its prompt is in front). Exits when none are left.
fn close_next_quit_window<R: Runtime>(app: &AppHandle<R>) {
    loop {
        let next_label = {
            let registry = app.state::<WindowRegistry>();
            let mut state = registry.state.lock().unwrap();
            if !state.is_quitting {
                return;
            }
            state.quit_queue.pop()
        };
        let Some(label) = next_label else {
            if !has_document_windows(app) {
                if with_registry(app, |state| state.restarts_after_quit) {
                    app.restart();
                }
                app.exit(0);
            }
            return;
        };
        if let Some(window) = app.get_window(&label) {
            let _ = window.set_focus();
            let _ = window.close();
            return;
        }
    }
}

/// Remembers the open windows for the next launch, then closes them one by one; each asks about unsaved changes.
pub fn start_quit<R: Runtime>(app: &AppHandle<R>) {
    let open_labels: Vec<String> = document_windows(app).iter().map(|window| window.label().to_string()).collect();
    {
        let registry = app.state::<WindowRegistry>();
        let mut state = registry.state.lock().unwrap();
        // shortcut: panes of a split come back as separate tabs; store the layout in the session if splits should return.
        let session_windows: Vec<SessionWindow> = open_labels
            .iter()
            .flat_map(|label| state.layouts.get(label).map(|layout| layout.panes.clone()).unwrap_or_default())
            .filter_map(|pane| state.windows.get(&pane))
            .filter(|entry| entry.document_path.is_some() || entry.folder_path.is_some())
            .map(|entry| SessionWindow {
                path: entry.document_path.as_deref().map(path_to_string),
                folder: entry.folder_path.as_deref().map(path_to_string),
            })
            .collect();
        session::save_session(app, &session_windows);
        state.is_quitting = true;
        state.quit_queue = open_labels;
    }
    close_next_quit_window(app);
}

/// Quits like ⌘Q (asking about unsaved changes), then starts Jot again. Cancelling a prompt cancels the restart too.
pub fn restart_after_quit<R: Runtime>(app: &AppHandle<R>) {
    with_registry(app, |state| state.restarts_after_quit = true);
    start_quit(app);
}

pub fn handle_window_destroyed<R: Runtime>(app: &AppHandle<R>, label: &str) {
    let is_quitting = with_registry(app, |state| {
        let closed_panes: Vec<String> = state.windows.iter().filter(|(_, entry)| entry.window_label == label).map(|(pane, _)| pane.clone()).collect();
        for pane in &closed_panes {
            if let Some(entry) = state.windows.remove(pane) {
                remember_closed_pane(state, &entry);
            }
            state.close_handlers.remove(pane);
        }
        state.close_handlers.remove(label);
        state.layouts.remove(label);
        state.closing.remove(label);
        state.is_quitting
    });
    if is_quitting && is_document_window(label) {
        close_next_quit_window(app);
    }
}

/// Updates every window that shows a renamed file or a file inside a renamed folder, and tells all windows.
pub fn handle_path_renamed<R: Runtime>(app: &AppHandle<R>, from: &Path, to: &Path) {
    {
        let registry = app.state::<WindowRegistry>();
        let mut state = registry.state.lock().unwrap();
        for entry in state.windows.values_mut() {
            if let Some(renamed) = entry.document_path.as_deref().and_then(|path| recent::renamed_path(path, from, to)) {
                entry.document_path = Some(renamed);
            }
            if let Some(renamed) = entry.folder_path.as_deref().and_then(|path| recent::renamed_path(path, from, to)) {
                entry.folder_path = Some(renamed);
            }
        }
    }
    recent::rename_recent_items(app, from, to);
    let _ = app.emit(PATH_RENAMED_EVENT, PathRenamed { from: path_to_string(from), to: path_to_string(to) });
}

#[tauri::command]
pub fn get_document_context(webview: Webview, registry: tauri::State<WindowRegistry>) -> DocumentContext {
    let mut state = registry.state.lock().unwrap();
    let Some(entry) = state.windows.get_mut(webview.label()) else {
        return DocumentContext { path: None, folder_path: None, starting_text: None };
    };
    DocumentContext {
        path: entry.document_path.as_deref().map(path_to_string),
        folder_path: entry.folder_path.as_deref().map(path_to_string),
        // Handed over once: a reload of the page must not apply it again.
        starting_text: entry.starting_text.take(),
    }
}

/// Makes this window show `path` (or nothing, for untitled). Returns false (and focuses that window)
/// when another window already has the file open.
#[tauri::command]
pub fn claim_document_path(app: AppHandle, webview: Webview, registry: tauri::State<WindowRegistry>, path: Option<String>) -> bool {
    let path = path.map(|path| resolve_target_path(Path::new(&path)));
    let mut state = registry.state.lock().unwrap();
    if let Some(other_label) = path.as_deref().and_then(|path| window_showing_document(&state, path)).filter(|label| label != webview.label()) {
        drop(state);
        let _ = focus_window(&app, &other_label);
        return false;
    }
    if let Some(entry) = state.windows.get_mut(webview.label()) {
        entry.document_path = path.clone();
    }
    drop(state);
    if let Some(path) = path {
        recent::note_recent_item(&app, &path);
    }
    true
}

#[tauri::command]
pub fn set_window_folder(webview: Webview, registry: tauri::State<WindowRegistry>, folder: Option<String>) {
    let mut state = registry.state.lock().unwrap();
    if let Some(entry) = state.windows.get_mut(webview.label()) {
        entry.folder_path = folder.map(|folder| resolve_target_path(Path::new(&folder)));
    }
}

/// Opens files in new tabs, new windows, or the other pane of a split ("tab", "window" or "split").
/// `folder` lets them keep showing the sidebar's folder.
#[tauri::command]
pub fn open_paths(app: AppHandle, webview: Webview, paths: Vec<String>, folder: Option<String>, placement: String) -> Result<(), String> {
    for path in paths {
        let folder = folder.as_ref().map(PathBuf::from);
        let path = PathBuf::from(path);
        let result = match placement.as_str() {
            "window" => open_document_in_new_window(&app, Some(path), folder),
            "split" => panes::open_beside(&app, webview.label(), path, folder),
            _ => open_document_window(&app, Some(path), folder),
        };
        result.map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Picks a tab of the focused window's tab group (`None` is the last), or does nothing without tabs.
pub fn select_tab_in_focused_window<R: Runtime>(app: &AppHandle<R>, index: Option<usize>) {
    if let Some(window) = focused_document_window(app) {
        tabs::select_tab(&window, index);
    }
}

/// A window that has shown itself lets later windows join it as tabs, even if it opened on its own.
pub fn handle_window_focused<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(window) = app.get_window(label).filter(|_| is_document_window(label)) {
        tabs::set_joins_tabs(&window, true);
    }
}

/// Opens an untitled window holding `contents`, shown as `kind` (used by Convert to JSON/YAML/CSV).
#[tauri::command]
pub fn open_new_document(app: AppHandle, contents: String, kind: String) -> Result<(), String> {
    let starting_text = StartingText { text: contents, draft_id: None, kind: Some(kind) };
    create_window(&app, WindowEntry { starting_text: Some(starting_text), ..Default::default() }).map_err(|error| error.to_string())
}

/// Dropped folders go to this window's sidebar; dropped files open in their own windows.
#[tauri::command]
pub fn open_dropped_paths(app: AppHandle, webview: Webview, paths: Vec<String>) -> Result<(), String> {
    for path in paths.iter().map(PathBuf::from) {
        if path.is_dir() {
            show_folder_in_window(&app, webview.label(), &path);
        } else {
            open_document_window(&app, Some(path), None).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn cancel_quit(registry: tauri::State<WindowRegistry>) {
    let mut state = registry.state.lock().unwrap();
    state.is_quitting = false;
    state.restarts_after_quit = false;
    state.quit_queue.clear();
}
