mod files;
mod folders;
mod menu;
mod migration;
mod panes;
mod recent;
mod session;
mod settings;
mod tabs;
mod windows;

use std::path::PathBuf;
use std::time::Duration;

use tauri::{AppHandle, Manager, RunEvent, WindowEvent};

use menu::MenuCommands;
use recent::RecentItems;
use windows::WindowRegistry;

/// Files and folders passed on the command line (Linux "Open With" and terminal use).
fn paths_from_arguments() -> Vec<PathBuf> {
    std::env::args()
        .skip(1)
        .filter(|argument| !argument.starts_with('-'))
        .map(PathBuf::from)
        .filter(|path| path.exists())
        .collect()
}

/// Runs just after launch, once files opened from Finder have arrived. Without any, the windows from the
/// last quit come back (if enabled in Settings); with nothing to restore, an empty document opens.
fn open_startup_windows(app: &AppHandle) {
    if windows::has_document_windows(app) {
        return;
    }
    if settings::should_reopen_windows(app) {
        windows::restore_session(app);
    }
    if !windows::has_document_windows(app) {
        let _ = windows::open_document_window(app, None, None);
    }
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(WindowRegistry::default())
        .manage(RecentItems::default())
        .manage(MenuCommands::default())
        .menu(menu::build_menu)
        .on_menu_event(|app, event| menu::handle_menu_event(app, event.id().as_ref()))
        .on_window_event(|window, event| {
            panes::handle_window_event(window, event);
            match event {
                WindowEvent::Destroyed => windows::handle_window_destroyed(window.app_handle(), window.label()),
                WindowEvent::Focused(true) => windows::handle_window_focused(window.app_handle(), window.label()),
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            files::read_text_file,
            files::write_text_file,
            files::file_modified_time,
            files::save_image,
            files::open_in_default_app,
            settings::load_settings,
            settings::save_settings,
            menu::get_menu_commands,
            folders::read_directory,
            folders::list_folder_files,
            folders::create_file,
            folders::create_folder,
            folders::rename_path,
            recent::get_recent_files,
            session::write_draft,
            session::delete_draft,
            windows::get_document_context,
            windows::claim_document_path,
            windows::set_window_folder,
            windows::open_paths,
            windows::open_new_document,
            windows::open_dropped_paths,
            windows::cancel_quit,
            panes::answer_close_request,
            panes::register_close_handler,
            panes::pane_focused,
            panes::set_pane_title,
            panes::move_split_divider,
        ])
        .setup(|app| {
            migration::migrate_previous_app_data(app.handle());
            recent::load_recent_items(app.handle());
            // Unsaved work from a crash comes back first, whatever else opens.
            windows::recover_drafts(app.handle(), session::load_drafts(app.handle()));
            for path in paths_from_arguments() {
                windows::open_document_window(app.handle(), Some(path), None)?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Jot");

    app.run(|app, event| match event {
        RunEvent::Ready => {
            // Files opened from Finder arrive just after launch, so wait a moment before deciding what else to open.
            let app = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(250));
                let main_thread_app = app.clone();
                let _ = app.run_on_main_thread(move || open_startup_windows(&main_thread_app));
            });
        }
        #[cfg(target_os = "macos")]
        RunEvent::Opened { urls } => {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    let _ = windows::open_document_window(app, Some(path), None);
                }
            }
        }
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { has_visible_windows, .. } => {
            if !has_visible_windows && !windows::has_document_windows(app) {
                let _ = windows::open_document_window(app, None, None);
            }
        }
        RunEvent::ExitRequested { api, code, .. } => {
            if code.is_some() {
                return;
            }
            if windows::has_document_windows(app) {
                // A system quit (dock, logout) must still ask about unsaved changes.
                api.prevent_exit();
                windows::start_quit(app);
                return;
            }
            // Mac apps stay running after the last window closes.
            if cfg!(target_os = "macos") {
                api.prevent_exit();
            }
        }
        _ => {}
    });
}
