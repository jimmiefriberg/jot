//! Native macOS window tabs. Document windows join the front window's tabs when they first show,
//! unless they were asked to open as their own window. Elsewhere these do nothing.

use tauri::{Runtime, Window};

#[cfg(target_os = "macos")]
fn with_ns_window<R: Runtime>(window: &Window<R>, action: impl FnOnce(&objc2_app_kit::NSWindow)) {
    let Ok(pointer) = window.ns_window() else { return };
    // SAFETY: Tauri hands out the window's live NSWindow, and callers are on the main thread (menu and window events).
    let ns_window = unsafe { &*pointer.cast::<objc2_app_kit::NSWindow>() };
    action(ns_window);
}

/// Whether the window joins the front window's tabs when it's shown (true) or opens on its own (false).
pub fn set_joins_tabs<R: Runtime>(window: &Window<R>, joins_tabs: bool) {
    #[cfg(target_os = "macos")]
    with_ns_window(window, |ns_window| {
        use objc2_app_kit::NSWindowTabbingMode;
        ns_window.setTabbingMode(if joins_tabs { NSWindowTabbingMode::Preferred } else { NSWindowTabbingMode::Disallowed });
    });
    #[cfg(not(target_os = "macos"))]
    let _ = (window, joins_tabs);
}

/// Brings the tab at `index` (counting from 0) of the window's tab group to the front; `None` picks the last tab.
pub fn select_tab<R: Runtime>(window: &Window<R>, index: Option<usize>) {
    #[cfg(target_os = "macos")]
    with_ns_window(window, |ns_window| {
        let Some(tab_group) = ns_window.tabGroup() else { return };
        let tabs = tab_group.windows();
        let count = tabs.count();
        let Some(target) = index.or(count.checked_sub(1)).filter(|index| *index < count) else { return };
        tab_group.setSelectedWindow(Some(&tabs.objectAtIndex(target)));
    });
    #[cfg(not(target_os = "macos"))]
    let _ = (window, index);
}
