//! Updates from GitHub releases, and the Help menu's problem report.

use std::process::Command;

use tauri::{AppHandle, Runtime, Url};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::windows;

const NEW_ISSUE_URL: &str = "https://github.com/jimmiefriberg/jot/issues/new";

fn show_message<R: Runtime>(app: &AppHandle<R>, title: &str, message: &str) {
    app.dialog().message(message).title(title).show(|_| {});
}

/// Checks for a newer Jot. At launch it stays quiet unless there is one; from the menu it always answers.
pub fn check_for_updates<R: Runtime>(app: &AppHandle<R>, is_from_menu: bool) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = match app.updater() {
            Ok(updater) => updater.check().await,
            Err(error) => Err(error),
        };
        match result {
            Ok(Some(update)) => offer_update(&app, update),
            Ok(None) if is_from_menu => {
                show_message(&app, "Jot is up to date", &format!("Version {} is the newest version.", app.package_info().version));
            }
            Err(error) if is_from_menu => show_message(&app, "Couldn't check for updates", &error.to_string()),
            _ => {}
        }
    });
}

fn offer_update<R: Runtime>(app: &AppHandle<R>, update: Update) {
    let notes = update.body.clone().unwrap_or_default();
    let message = format!("Jot {} is available (you have {}).\n\n{notes}", update.version, app.package_info().version);
    let app_handle = app.clone();
    app.dialog()
        .message(message.trim_end())
        .title("Update available")
        .buttons(MessageDialogButtons::OkCancelCustom("Install and Restart".into(), "Later".into()))
        .show(move |should_install| {
            if should_install {
                install_update(app_handle, update);
            }
        });
}

/// Downloads and installs the update, then quits the usual way (asking about unsaved changes) and starts the new version.
fn install_update<R: Runtime>(app: AppHandle<R>, update: Update) {
    tauri::async_runtime::spawn(async move {
        match update.download_and_install(|_, _| {}, || {}).await {
            Ok(()) => windows::restart_after_quit(&app),
            Err(error) => show_message(&app, "Couldn't install the update", &error.to_string()),
        }
    });
}

fn macos_version() -> String {
    Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .unwrap_or_default()
}

/// Opens a new GitHub issue with Jot's and macOS's versions filled in.
pub fn report_problem<R: Runtime>(app: &AppHandle<R>) {
    let body = format!(
        "**What happened?**\n\n\n**What did you expect?**\n\n\n**Steps to reproduce**\n1. \n\n---\nJot {} · macOS {}",
        app.package_info().version,
        macos_version()
    );
    if let Ok(url) = Url::parse_with_params(NEW_ISSUE_URL, &[("body", body)]) {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}
