use std::path::Path;

use tauri::menu::{AboutMetadata, Menu, MenuBuilder, MenuItem, MenuItemBuilder, Submenu, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::recent;
use crate::windows;

const RECENT_ITEM_PREFIX: &str = "recent.open.";
const CLEAR_RECENT_ID: &str = "recent.clear";

fn menu_item<R: Runtime>(app: &AppHandle<R>, id: &str, text: &str, accelerator: Option<&str>) -> tauri::Result<MenuItem<R>> {
    let builder = MenuItemBuilder::with_id(id, text);
    let builder = match accelerator {
        Some(accelerator) => builder.accelerator(accelerator),
        None => builder,
    };
    builder.build(app)
}

/// "notes.md — Documents", so files with the same name in different folders can be told apart.
fn recent_item_label(path: &Path) -> String {
    let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
    match path.parent().and_then(|parent| parent.file_name()) {
        Some(parent) => format!("{name} — {}", parent.to_string_lossy()),
        None => name,
    }
}

fn build_recent_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let recent_paths = recent::recent_item_paths(app);
    let mut builder = SubmenuBuilder::new(app, "Open Recent");
    for (index, path) in recent_paths.iter().enumerate() {
        builder = builder.item(&menu_item(app, &format!("{RECENT_ITEM_PREFIX}{index}"), &recent_item_label(path), None)?);
    }
    if !recent_paths.is_empty() {
        builder = builder.separator();
    }
    let clear_item = MenuItemBuilder::with_id(CLEAR_RECENT_ID, "Clear Menu").enabled(!recent_paths.is_empty()).build(app)?;
    builder.item(&clear_item).build()
}

pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let item = |id: &str, text: &str, accelerator: Option<&str>| menu_item(app, id, text, accelerator);

    let app_menu = SubmenuBuilder::new(app, "Jot")
        .about(Some(AboutMetadata::default()))
        .separator()
        .item(&item("app.settings", "Settings…", Some("CmdOrCtrl+Comma"))?)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .item(&item("app.quit", "Quit Jot", Some("CmdOrCtrl+Q"))?)
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&item("file.new", "New", Some("CmdOrCtrl+N"))?)
        .item(&item("file.open", "Open…", Some("CmdOrCtrl+O"))?)
        .item(&build_recent_menu(app)?)
        .item(&item("file.openFolder", "Open Folder…", Some("CmdOrCtrl+Shift+O"))?)
        .item(&item("file.quickOpen", "Quick Open…", Some("CmdOrCtrl+P"))?)
        .separator()
        .close_window()
        .item(&item("file.save", "Save", Some("CmdOrCtrl+S"))?)
        .item(&item("file.saveAs", "Save As…", Some("CmdOrCtrl+Shift+S"))?)
        .item(&item("file.revert", "Revert to Saved", None)?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&item("edit.undo", "Undo", Some("CmdOrCtrl+Z"))?)
        .item(&item("edit.redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&item("edit.find", "Find…", Some("CmdOrCtrl+F"))?)
        .item(&item("edit.replace", "Find and Replace…", Some("CmdOrCtrl+Alt+F"))?)
        .item(&item("edit.findNext", "Find Next", Some("CmdOrCtrl+G"))?)
        .item(&item("edit.findPrevious", "Find Previous", Some("CmdOrCtrl+Shift+G"))?)
        .item(&item("edit.gotoLine", "Go to Line…", Some("Ctrl+G"))?)
        .build()?;

    let selection_menu = SubmenuBuilder::new(app, "Selection")
        .item(&item("selection.insertLineAbove", "Insert Line Above", Some("CmdOrCtrl+Shift+Enter"))?)
        .item(&item("selection.insertLineBelow", "Insert Line Below", Some("CmdOrCtrl+Enter"))?)
        .separator()
        .item(&item("selection.moveLineUp", "Move Line Up", Some("Alt+ArrowUp"))?)
        .item(&item("selection.moveLineDown", "Move Line Down", Some("Alt+ArrowDown"))?)
        .item(&item("selection.copyLineUp", "Copy Line Up", Some("Alt+Shift+ArrowUp"))?)
        .item(&item("selection.copyLineDown", "Copy Line Down", Some("Alt+Shift+ArrowDown"))?)
        .item(&item("selection.deleteLine", "Delete Line", Some("CmdOrCtrl+Shift+K"))?)
        .separator()
        .item(&item("selection.selectLine", "Select Line", Some("CmdOrCtrl+L"))?)
        .item(&item("selection.addNextOccurrence", "Add Next Occurrence", Some("CmdOrCtrl+D"))?)
        .item(&item("selection.selectAllOccurrences", "Select All Occurrences", Some("CmdOrCtrl+Shift+L"))?)
        .item(&item("selection.addCursorAbove", "Add Cursor Above", Some("CmdOrCtrl+Alt+ArrowUp"))?)
        .item(&item("selection.addCursorBelow", "Add Cursor Below", Some("CmdOrCtrl+Alt+ArrowDown"))?)
        .separator()
        .item(&item("selection.indent", "Indent", Some("CmdOrCtrl+BracketRight"))?)
        .item(&item("selection.outdent", "Outdent", Some("CmdOrCtrl+BracketLeft"))?)
        .item(&item("selection.toggleComment", "Toggle Comment", Some("CmdOrCtrl+Slash"))?)
        .build()?;

    let format_menu = SubmenuBuilder::new(app, "Format")
        .item(&item("format.bold", "Bold", Some("CmdOrCtrl+B"))?)
        .item(&item("format.italic", "Italic", Some("CmdOrCtrl+I"))?)
        .item(&item("format.inlineCode", "Inline Code", Some("CmdOrCtrl+Shift+C"))?)
        .item(&item("format.link", "Link", Some("CmdOrCtrl+K"))?)
        .separator()
        .item(&item("format.upperCase", "Make Upper Case", None)?)
        .item(&item("format.lowerCase", "Make Lower Case", None)?)
        .item(&item("format.titleCase", "Capitalize Words", None)?)
        .separator()
        .item(&item("format.sortAscending", "Sort Lines", None)?)
        .item(&item("format.sortDescending", "Sort Lines Descending", None)?)
        .item(&item("format.removeTrailingWhitespace", "Remove Trailing Whitespace", None)?)
        .separator()
        .item(&item("view.formatDocument", "Format Document", Some("Alt+Shift+F"))?)
        .separator()
        .item(&item("format.convertToJson", "Convert to JSON", None)?)
        .item(&item("format.convertToYaml", "Convert to YAML", None)?)
        .item(&item("format.convertToCsv", "Convert to CSV", None)?)
        .build()?;

    // Column moves use ⌥←/⌥→ handled inside the table, so word navigation in text keeps working.
    let table_menu = SubmenuBuilder::new(app, "Table")
        .item(&item("table.insertColumnLeft", "Insert Column Left", None)?)
        .item(&item("table.insertColumnRight", "Insert Column Right", None)?)
        .separator()
        .item(&item("table.moveColumnLeft", "Move Column Left  (⌥←)", None)?)
        .item(&item("table.moveColumnRight", "Move Column Right  (⌥→)", None)?)
        .separator()
        .item(&item("table.sortAscending", "Sort by Column A→Z", None)?)
        .item(&item("table.sortDescending", "Sort by Column Z→A", None)?)
        .item(&item("table.filter", "Filter Rows…", None)?)
        .separator()
        .item(&item("table.deleteRows", "Delete Row", None)?)
        .item(&item("table.deleteColumns", "Delete Column", None)?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&item("view.toggleFormatted", "Toggle Formatted / Plain", Some("CmdOrCtrl+E"))?)
        .item(&item("view.toggleSidebar", "Toggle Sidebar", Some("CmdOrCtrl+Backslash"))?)
        .item(&item("view.showOutline", "Show Outline", Some("CmdOrCtrl+Alt+O"))?)
        .item(&item("view.swapSidebarSide", "Move Sidebar to Other Side", None)?)
        .separator()
        .item(&item("view.wordWrap", "Toggle Word Wrap", Some("Alt+Z"))?)
        .item(&item("view.lineNumbers", "Toggle Line Numbers", None)?)
        .item(&item("view.showInvisibles", "Toggle Invisible Characters", None)?)
        .separator()
        .item(&item("view.typewriter", "Toggle Typewriter Scrolling", None)?)
        .item(&item("view.focusMode", "Toggle Focus Mode", None)?)
        .separator()
        .item(&item("view.expandAll", "Expand All", None)?)
        .item(&item("view.collapseAll", "Collapse All", None)?)
        .separator()
        .item(&item("view.zoomIn", "Bigger", Some("CmdOrCtrl+Equal"))?)
        .item(&item("view.zoomOut", "Smaller", Some("CmdOrCtrl+Minus"))?)
        .item(&item("view.zoomReset", "Actual Size", Some("CmdOrCtrl+Digit0"))?)
        .separator()
        .fullscreen()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window").minimize().maximize().build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &selection_menu, &format_menu, &table_menu, &view_menu, &window_menu])
        .build()
}

fn open_recent_item<R: Runtime>(app: &AppHandle<R>, index_text: &str) {
    let Ok(index) = index_text.parse::<usize>() else { return };
    if let Some(path) = recent::recent_item_paths(app).into_iter().nth(index) {
        let _ = windows::open_document_window(app, Some(path), None);
    }
}

/// App-level actions run here; everything else goes to the focused window.
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    if let Some(index_text) = id.strip_prefix(RECENT_ITEM_PREFIX) {
        open_recent_item(app, index_text);
        return;
    }
    match id {
        "app.settings" => {
            let _ = windows::open_settings_window(app);
        }
        "app.quit" => windows::start_quit(app),
        "file.new" => {
            let _ = windows::open_document_window(app, None, None);
        }
        "file.open" => windows::show_open_dialog(app),
        "file.openFolder" => windows::show_open_folder_dialog(app),
        CLEAR_RECENT_ID => recent::clear_recent_items(app),
        _ => {
            let focused_window = app
                .webview_windows()
                .into_values()
                .find(|window| window.is_focused().unwrap_or(false));
            if let Some(window) = focused_window {
                let _ = app.emit_to(window.label(), "menu-action", id);
            }
        }
    }
}
