//! Split view: a document window can show two panes side by side, each its own web view running a full editor.
//! Rust lays the panes out, routes menu actions to the active one, and closes them one prompt at a time.

use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime, Webview, WebviewBuilder, WebviewUrl, Window, WindowEvent};

use crate::files::resolve_target_path;
use crate::recent;
use crate::windows::{self, with_registry, WindowEntry};

const PANE_LAYOUT_EVENT: &str = "pane-layout";
const OPEN_IN_PANE_EVENT: &str = "open-in-pane";
const CLOSE_REQUESTED_EVENT: &str = "close-requested";
const DEFAULT_SPLIT_RATIO: f64 = 0.5;
const MINIMUM_SPLIT_RATIO: f64 = 0.2;
const MAXIMUM_SPLIT_RATIO: f64 = 0.8;

/// The panes of one window, left to right, and how wide the left one is.
pub(crate) struct Layout {
    pub(crate) panes: Vec<String>,
    split_ratio: f64,
    active_pane: String,
}

impl Layout {
    pub(crate) fn single(pane: &str) -> Self {
        Layout { panes: vec![pane.to_string()], split_ratio: DEFAULT_SPLIT_RATIO, active_pane: pane.to_string() }
    }
}

/// Panes still to be asked about unsaved changes before closing; the whole window closes once all agree.
pub(crate) struct CloseRequest {
    remaining: Vec<String>,
    closes_window: bool,
}

/// Where a pane sits, so its page can draw the divider.
#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
enum PanePosition {
    Single,
    Left,
    Right,
}

fn window_of_pane<R: Runtime>(app: &AppHandle<R>, pane: &str) -> Option<String> {
    with_registry(app, |state| state.windows.get(pane).map(|entry| entry.window_label.clone()))
}

/// The pane menu actions go to: the one last focused, or the window's only pane.
pub(crate) fn active_pane<R: Runtime>(app: &AppHandle<R>, window_label: &str) -> String {
    with_registry(app, |state| state.layouts.get(window_label).map(|layout| layout.active_pane.clone())).unwrap_or_else(|| window_label.to_string())
}

/// Makes a pane the active one and shows its title on the window.
pub(crate) fn set_active_pane<R: Runtime>(app: &AppHandle<R>, pane: &str) {
    let window_title = with_registry(app, |state| {
        let entry = state.windows.get(pane)?;
        let (window_label, title) = (entry.window_label.clone(), entry.title.clone());
        state.layouts.get_mut(&window_label)?.active_pane = pane.to_string();
        Some((window_label, title))
    });
    if let Some((window_label, title)) = window_title {
        if let Some(window) = app.get_window(&window_label) {
            let _ = window.set_title(&title);
        }
    }
}

/// Sizes the panes to fill the window (side by side when split) and tells each page where it sits.
fn lay_out<R: Runtime>(app: &AppHandle<R>, window: &Window<R>) {
    let Some((pane_labels, split_ratio)) = with_registry(app, |state| state.layouts.get(window.label()).map(|layout| (layout.panes.clone(), layout.split_ratio))) else {
        return;
    };
    let (Ok(size), Ok(scale_factor)) = (window.inner_size(), window.scale_factor()) else { return };
    let size = size.to_logical::<f64>(scale_factor);
    let left_width = (size.width * split_ratio).round();
    for (index, pane) in pane_labels.iter().enumerate() {
        let Some(webview) = app.get_webview(pane) else { continue };
        let (x, width, position) = match (pane_labels.len(), index) {
            (1, _) => (0.0, size.width, PanePosition::Single),
            (_, 0) => (0.0, left_width, PanePosition::Left),
            _ => (left_width, size.width - left_width, PanePosition::Right),
        };
        let _ = webview.set_position(LogicalPosition::new(x, 0.0));
        let _ = webview.set_size(LogicalSize::new(width, size.height));
        let _ = webview.emit_to(pane.as_str(), PANE_LAYOUT_EVENT, position);
    }
}

/// Keeps split panes filling the window as it resizes. (A single pane follows the window on its own.)
pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    let app = window.app_handle();
    match event {
        WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } => {
            let is_split = with_registry(app, |state| state.layouts.get(window.label()).is_some_and(|layout| layout.panes.len() > 1));
            if is_split {
                lay_out(app, window);
            }
        }
        WindowEvent::CloseRequested { api, .. } if start_closing(app, window.label(), None) => api.prevent_close(),
        _ => {}
    }
}

/// Adds a pane to the right of a window's only pane, showing `entry`.
fn add_pane<R: Runtime>(app: &AppHandle<R>, window: &Window<R>, entry: WindowEntry) -> tauri::Result<()> {
    let pane = with_registry(app, |state| {
        let pane = windows::next_document_label(state);
        let title = windows::window_title(entry.document_path.as_deref().or(entry.folder_path.as_deref()));
        state.windows.insert(pane.clone(), WindowEntry { window_label: window.label().to_string(), title, ..entry });
        if let Some(layout) = state.layouts.get_mut(window.label()) {
            layout.panes.push(pane.clone());
            layout.active_pane = pane.clone();
        }
        pane
    });
    // The first pane stops following the window by itself; from now on `lay_out` places both.
    if let Some(first_pane) = app.get_webview(window.label()) {
        let _ = first_pane.set_auto_resize(false);
    }
    let size = window.inner_size()?.to_logical::<f64>(window.scale_factor()?);
    let webview = window.add_child(
        WebviewBuilder::new(&pane, WebviewUrl::App("index.html".into())),
        LogicalPosition::new(size.width / 2.0, 0.0),
        LogicalSize::new(size.width / 2.0, size.height),
    )?;
    lay_out(app, window);
    webview.set_focus()?;
    Ok(())
}

/// View → Split Right: opens an empty pane (showing the same folder) beside this one, or moves to the other pane.
pub fn split_right<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = windows::focused_document_window(app) else { return };
    let (pane_labels, active) = with_registry(app, |state| {
        let layout = state.layouts.get(window.label());
        (layout.map(|layout| layout.panes.clone()).unwrap_or_default(), layout.map(|layout| layout.active_pane.clone()))
    });
    if let Some(other_pane) = pane_labels.iter().find(|pane| Some(*pane) != active.as_ref()).filter(|_| pane_labels.len() > 1) {
        let _ = windows::focus_window(app, other_pane);
        return;
    }
    let folder_path = with_registry(app, |state| active.and_then(|pane| state.windows.get(&pane)).and_then(|entry| entry.folder_path.clone()));
    let _ = add_pane(app, &window, WindowEntry { folder_path, ..Default::default() });
}

/// Opens a file in the pane beside `from_pane`: the other pane of a split, or a new pane on the right.
pub fn open_beside<R: Runtime>(app: &AppHandle<R>, from_pane: &str, path: PathBuf, folder: Option<PathBuf>) -> tauri::Result<()> {
    let path = resolve_target_path(&path);
    let existing_pane = with_registry(app, |state| windows::window_showing_document(state, &path));
    if let Some(existing_pane) = existing_pane {
        return windows::focus_window(app, &existing_pane);
    }
    let Some(window_label) = window_of_pane(app, from_pane) else { return Ok(()) };
    let Some(window) = app.get_window(&window_label) else { return Ok(()) };
    let other_pane = with_registry(app, |state| {
        state.layouts.get(&window_label).and_then(|layout| layout.panes.iter().find(|pane| pane.as_str() != from_pane).cloned())
    });
    match other_pane {
        // The other pane opens it the usual way, so it asks about its own unsaved changes first.
        Some(other_pane) => {
            windows::focus_window(app, &other_pane)?;
            app.emit_to(other_pane.as_str(), OPEN_IN_PANE_EVENT, path.to_string_lossy().into_owned())?;
        }
        None => {
            recent::note_recent_item(app, &path);
            let folder_path = folder.map(|folder| resolve_target_path(&folder));
            add_pane(app, &window, WindowEntry { document_path: Some(path), folder_path, ..Default::default() })?;
        }
    }
    Ok(())
}

/// Starts closing a whole window (`pane` is None) or one pane of a split. Each pane with a page asks about unsaved
/// changes in turn. Returns false when nothing needs asking, so the caller can just close.
fn start_closing<R: Runtime>(app: &AppHandle<R>, window_label: &str, pane: Option<&str>) -> bool {
    let first_pane = with_registry(app, |state| {
        if state.closing.contains_key(window_label) {
            // Already asking; a second click on the close button waits for that answer.
            return Some(None);
        }
        let panes_to_close = match pane {
            Some(pane) => vec![pane.to_string()],
            None => state.layouts.get(window_label).map(|layout| layout.panes.clone()).unwrap_or_else(|| vec![window_label.to_string()]),
        };
        let remaining: Vec<String> = panes_to_close.into_iter().filter(|pane| state.close_handlers.contains(pane)).collect();
        let first = remaining.first().cloned()?;
        state.closing.insert(window_label.to_string(), CloseRequest { remaining, closes_window: pane.is_none() });
        Some(Some(first))
    });
    match first_pane {
        None => false,
        Some(None) => true,
        Some(Some(first)) => {
            let _ = app.emit_to(first.as_str(), CLOSE_REQUESTED_EVENT, ());
            true
        }
    }
}

/// Removes one pane of a split; the other one fills the window again.
fn close_pane<R: Runtime>(app: &AppHandle<R>, window: &Window<R>, pane: &str) {
    let remaining_pane = with_registry(app, |state| {
        if let Some(entry) = state.windows.remove(pane) {
            windows::remember_closed_pane(state, &entry);
        }
        state.close_handlers.remove(pane);
        let layout = state.layouts.get_mut(window.label())?;
        layout.panes.retain(|label| label != pane);
        layout.active_pane = layout.panes.first()?.clone();
        Some(layout.active_pane.clone())
    });
    if let Some(webview) = app.get_webview(pane) {
        let _ = webview.close();
    }
    let Some(remaining_pane) = remaining_pane else {
        let _ = window.destroy();
        return;
    };
    lay_out(app, window);
    if let Some(webview) = app.get_webview(&remaining_pane) {
        let _ = webview.set_auto_resize(true);
    }
    let _ = windows::focus_window(app, &remaining_pane);
}

/// ⌘W: closes the active pane of a split, or else the focused window.
pub fn close_focused<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.windows().into_values().find(|window| window.is_focused().unwrap_or(false)) else { return };
    let pane_labels = with_registry(app, |state| state.layouts.get(window.label()).map(|layout| layout.panes.clone()).unwrap_or_default());
    if pane_labels.len() < 2 {
        let _ = window.close();
        return;
    }
    let pane = active_pane(app, window.label());
    if !start_closing(app, window.label(), Some(&pane)) {
        close_pane(app, &window, &pane);
    }
}

/// A pane's answer to "close?". Yes moves on to the next pane (or closes); no stops closing, and any quit.
#[tauri::command]
pub fn answer_close_request(app: AppHandle, webview: Webview, is_allowed: bool) {
    let window = webview.window();
    let next_step = with_registry(&app, |state| {
        let request = state.closing.get_mut(window.label())?;
        if !is_allowed {
            state.closing.remove(window.label());
            state.is_quitting = false;
            state.quit_queue.clear();
            return None;
        }
        request.remaining.retain(|pane| pane != webview.label());
        let next_pane = request.remaining.first().cloned();
        let closes_window = request.closes_window;
        if next_pane.is_none() {
            state.closing.remove(window.label());
        }
        Some((next_pane, closes_window))
    });
    match next_step {
        None => {}
        Some((Some(next_pane), _)) => {
            let _ = windows::focus_window(&app, &next_pane);
            let _ = app.emit_to(next_pane.as_str(), CLOSE_REQUESTED_EVENT, ());
        }
        Some((None, true)) => {
            let _ = window.destroy();
        }
        Some((None, false)) => close_pane(&app, &window, webview.label()),
    }
}

/// Called once a page listens for close requests; until then it closes without asking.
#[tauri::command]
pub fn register_close_handler(webview: Webview, registry: tauri::State<windows::WindowRegistry>) {
    registry.state.lock().unwrap().close_handlers.insert(webview.label().to_string());
}

/// A pane got the keyboard focus: menu actions go to it now, and the window shows its title.
#[tauri::command]
pub fn pane_focused(app: AppHandle, webview: Webview) {
    set_active_pane(&app, webview.label());
}

/// A pane's title ("notes.md — Edited"); the window shows it while the pane is active.
#[tauri::command]
pub fn set_pane_title(app: AppHandle, webview: Webview, title: String) {
    let window_label = webview.window().label().to_string();
    let is_active = with_registry(&app, |state| {
        if let Some(entry) = state.windows.get_mut(webview.label()) {
            entry.title = title.clone();
        }
        state.layouts.get(&window_label).is_none_or(|layout| layout.active_pane == webview.label())
    });
    if is_active {
        let _ = webview.window().set_title(&title);
    }
}

/// Moves the divider to `screen_x` (from a drag in the page), or back to the middle when it's None.
#[tauri::command]
pub fn move_split_divider(app: AppHandle, webview: Webview, screen_x: Option<f64>) {
    let window = webview.window();
    let split_ratio = match screen_x {
        None => DEFAULT_SPLIT_RATIO,
        Some(screen_x) => {
            let (Ok(position), Ok(size), Ok(scale_factor)) = (window.inner_position(), window.inner_size(), window.scale_factor()) else { return };
            let left = position.to_logical::<f64>(scale_factor).x;
            let width = size.to_logical::<f64>(scale_factor).width;
            ((screen_x - left) / width).clamp(MINIMUM_SPLIT_RATIO, MAXIMUM_SPLIT_RATIO)
        }
    };
    with_registry(&app, |state| {
        if let Some(layout) = state.layouts.get_mut(window.label()) {
            layout.split_ratio = split_ratio;
        }
    });
    lay_out(&app, &window);
}
