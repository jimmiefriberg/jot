use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

use crate::recent;
use crate::session::{self, Draft, SessionWindow};

pub const SETTINGS_WINDOW_LABEL: &str = "settings";
const DOCUMENT_LABEL_PREFIX: &str = "document-";
const FOLDER_OPENED_EVENT: &str = "folder-opened";
const PATH_RENAMED_EVENT: &str = "path-renamed";

#[derive(Default)]
pub struct WindowRegistry {
    state: Mutex<RegistryState>,
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

/// What a document window shows: its file (if saved), the folder in its sidebar (if any) and any starting text.
#[derive(Default, Clone)]
struct WindowEntry {
    document_path: Option<PathBuf>,
    folder_path: Option<PathBuf>,
    starting_text: Option<StartingText>,
}

#[derive(Default)]
struct RegistryState {
    windows: HashMap<String, WindowEntry>,
    next_window_number: u64,
    is_quitting: bool,
    /// Windows still to close during a quit. They close one at a time, so each unsaved-changes prompt stands alone.
    quit_queue: Vec<String>,
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

fn normalize_path(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn window_title(path: Option<&Path>) -> String {
    path.and_then(|path| path.file_name())
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Untitled".to_string())
}

fn window_showing_document(state: &RegistryState, path: &Path) -> Option<String> {
    state
        .windows
        .iter()
        .find(|(_, entry)| entry.document_path.as_deref() == Some(path))
        .map(|(label, _)| label.clone())
}

fn focus_window<R: Runtime>(app: &AppHandle<R>, label: &str) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(label) {
        window.unminimize()?;
        window.set_focus()?;
    }
    Ok(())
}

/// Registers and builds a new (hidden) document window. It shows itself once its content is ready.
fn create_window<R: Runtime>(app: &AppHandle<R>, entry: WindowEntry) -> tauri::Result<()> {
    let has_folder = entry.folder_path.is_some();
    let title = window_title(entry.document_path.as_deref().or(entry.folder_path.as_deref()));
    let label = {
        let registry = app.state::<WindowRegistry>();
        let mut state = registry.state.lock().unwrap();
        state.next_window_number += 1;
        let label = format!("{DOCUMENT_LABEL_PREFIX}{}", state.next_window_number);
        state.windows.insert(label.clone(), entry);
        label
    };

    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(if has_folder { 1080.0 } else { 860.0 }, 680.0)
        .min_inner_size(360.0, 240.0)
        .visible(false);
    #[cfg(target_os = "macos")]
    let builder = builder.tabbing_identifier("text-editor-plus-document");

    builder.build()?;
    Ok(())
}

/// Opens a window for a file, a folder, or nothing (untitled). A file that's already open focuses its window instead.
pub fn open_document_window<R: Runtime>(app: &AppHandle<R>, path: Option<PathBuf>, folder: Option<PathBuf>) -> tauri::Result<()> {
    let path = path.map(|path| normalize_path(&path));
    let (document_path, folder_path) = match path {
        Some(path) if path.is_dir() => (None, Some(path)),
        other => (other, folder.map(|folder| normalize_path(&folder))),
    };

    let existing_label = {
        let registry = app.state::<WindowRegistry>();
        let state = registry.state.lock().unwrap();
        document_path.as_deref().and_then(|path| window_showing_document(&state, path))
    };
    if let Some(existing_label) = existing_label {
        return focus_window(app, &existing_label);
    }
    if let Some(recent_path) = document_path.as_deref().or(folder_path.as_deref()) {
        recent::note_recent_item(app, recent_path);
    }
    create_window(app, WindowEntry { document_path, folder_path, starting_text: None })
}

/// Reopens windows for drafts that survived a crash. Returns how many came back.
pub fn recover_drafts<R: Runtime>(app: &AppHandle<R>, drafts: Vec<Draft>) -> usize {
    let mut recovered_count = 0;
    for draft in drafts {
        let document_path = draft.path.as_deref().map(|path| normalize_path(Path::new(path)));
        let starting_text = StartingText { text: draft.text, draft_id: Some(draft.id), kind: None };
        if create_window(app, WindowEntry { document_path, folder_path: None, starting_text: Some(starting_text) }).is_ok() {
            recovered_count += 1;
        }
    }
    recovered_count
}

/// Reopens the windows that were open at the last quit, skipping files that are already open.
pub fn restore_session<R: Runtime>(app: &AppHandle<R>) {
    for window in session::load_session(app) {
        let document_path = window.path.as_deref().map(|path| normalize_path(Path::new(path)));
        let is_already_open = {
            let registry = app.state::<WindowRegistry>();
            let state = registry.state.lock().unwrap();
            document_path.as_deref().is_some_and(|path| window_showing_document(&state, path).is_some())
        };
        if is_already_open {
            continue;
        }
        let folder_path = window.folder.as_deref().map(|folder| normalize_path(Path::new(folder)));
        let _ = create_window(app, WindowEntry { document_path, folder_path, starting_text: None });
    }
}

/// Shows a folder in an existing window's sidebar.
fn show_folder_in_window<R: Runtime>(app: &AppHandle<R>, label: &str, folder: &Path) {
    let folder = normalize_path(folder);
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

pub fn show_open_dialog<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    app.dialog()
        .file()
        .add_filter("Text documents", &["txt", "md", "markdown", "json", "jsonc", "csv", "tsv", "yml", "yaml", "xml", "log"])
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

pub fn focused_document_window<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    app.webview_windows()
        .into_iter()
        .find(|(label, window)| is_document_window(label) && window.is_focused().unwrap_or(false))
        .map(|(_, window)| window)
}

/// Picks a folder and shows it in the focused window's sidebar, or in a new window when none is focused.
pub fn show_open_folder_dialog<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    let target_label = focused_document_window(app).map(|window| window.label().to_string());
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
    app.webview_windows().keys().any(|label| is_document_window(label))
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
                app.exit(0);
            }
            return;
        };
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.set_focus();
            let _ = window.close();
            return;
        }
    }
}

/// Remembers the open windows for the next launch, then closes them one by one; each asks about unsaved changes.
pub fn start_quit<R: Runtime>(app: &AppHandle<R>) {
    let open_labels: Vec<String> = app.webview_windows().into_keys().filter(|label| is_document_window(label)).collect();
    {
        let registry = app.state::<WindowRegistry>();
        let mut state = registry.state.lock().unwrap();
        let session_windows: Vec<SessionWindow> = open_labels
            .iter()
            .filter_map(|label| state.windows.get(label))
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

pub fn handle_window_destroyed<R: Runtime>(app: &AppHandle<R>, label: &str) {
    let is_quitting = {
        let registry = app.state::<WindowRegistry>();
        let mut state = registry.state.lock().unwrap();
        state.windows.remove(label);
        state.is_quitting
    };
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
pub fn get_document_context(window: WebviewWindow, registry: tauri::State<WindowRegistry>) -> DocumentContext {
    let mut state = registry.state.lock().unwrap();
    let Some(entry) = state.windows.get_mut(window.label()) else {
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
pub fn claim_document_path(app: AppHandle, window: WebviewWindow, registry: tauri::State<WindowRegistry>, path: Option<String>) -> bool {
    let path = path.map(|path| normalize_path(Path::new(&path)));
    let mut state = registry.state.lock().unwrap();
    if let Some(other_label) = path.as_deref().and_then(|path| window_showing_document(&state, path)).filter(|label| label != window.label()) {
        drop(state);
        let _ = focus_window(&app, &other_label);
        return false;
    }
    state.windows.entry(window.label().to_string()).or_default().document_path = path.clone();
    drop(state);
    if let Some(path) = path {
        recent::note_recent_item(&app, &path);
    }
    true
}

#[tauri::command]
pub fn set_window_folder(window: WebviewWindow, registry: tauri::State<WindowRegistry>, folder: Option<String>) {
    let mut state = registry.state.lock().unwrap();
    let entry = state.windows.entry(window.label().to_string()).or_default();
    entry.folder_path = folder.map(|folder| normalize_path(Path::new(&folder)));
}

/// Opens files in new windows. `folder` lets windows opened from a sidebar keep showing that folder.
#[tauri::command]
pub fn open_paths(app: AppHandle, paths: Vec<String>, folder: Option<String>) -> Result<(), String> {
    for path in paths {
        open_document_window(&app, Some(PathBuf::from(path)), folder.as_ref().map(PathBuf::from)).map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Opens an untitled window holding `contents`, shown as `kind` (used by Convert to JSON/YAML/CSV).
#[tauri::command]
pub fn open_new_document(app: AppHandle, contents: String, kind: String) -> Result<(), String> {
    let starting_text = StartingText { text: contents, draft_id: None, kind: Some(kind) };
    create_window(&app, WindowEntry { document_path: None, folder_path: None, starting_text: Some(starting_text) }).map_err(|error| error.to_string())
}

/// Dropped folders go to this window's sidebar; dropped files open in their own windows.
#[tauri::command]
pub fn open_dropped_paths(app: AppHandle, window: WebviewWindow, paths: Vec<String>) -> Result<(), String> {
    for path in paths.iter().map(PathBuf::from) {
        if path.is_dir() {
            show_folder_in_window(&app, window.label(), &path);
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
    state.quit_queue.clear();
}
