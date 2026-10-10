use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

/// The app was called "Text Editor Plus" before it became Jot; its settings, recent files and drafts lived here.
const PREVIOUS_IDENTIFIER: &str = "com.jimmiefriberg.texteditorplus";

fn copy_directory(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_directory(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

/// Copies the previous app's folder into a new one, once: only when the new folder doesn't exist yet.
/// The old folder is left in place, so nothing is lost if the copy fails.
fn copy_previous_directory(current_directory: &Path) {
    let Some(previous_directory) = current_directory.parent().map(|parent| parent.join(PREVIOUS_IDENTIFIER)) else { return };
    if current_directory.exists() || !previous_directory.is_dir() {
        return;
    }
    if copy_directory(&previous_directory, current_directory).is_err() {
        // A half-made copy would block the next attempt, so it's removed.
        let _ = fs::remove_dir_all(current_directory);
    }
}

/// Brings settings, recent files, the session and drafts over from the app's previous name. Run first at startup.
pub fn migrate_previous_app_data<R: Runtime>(app: &AppHandle<R>) {
    let mut directories: Vec<PathBuf> = [app.path().app_config_dir(), app.path().app_data_dir()].into_iter().flatten().collect();
    // On macOS the config and data folders are the same.
    directories.dedup();
    for directory in directories {
        copy_previous_directory(&directory);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copies_the_previous_folder_once() {
        let root = std::env::temp_dir().join(format!("jot-migration-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let previous = root.join(PREVIOUS_IDENTIFIER);
        fs::create_dir_all(previous.join("drafts")).unwrap();
        fs::write(previous.join("settings.json"), "{}").unwrap();
        fs::write(previous.join("drafts/one.json"), "draft").unwrap();

        let current = root.join("com.jimmiefriberg.jot");
        copy_previous_directory(&current);
        assert_eq!(fs::read_to_string(current.join("drafts/one.json")).unwrap(), "draft");

        // Later launches leave the new folder alone.
        fs::write(current.join("settings.json"), "{\"fontSize\":16}").unwrap();
        copy_previous_directory(&current);
        assert_eq!(fs::read_to_string(current.join("settings.json")).unwrap(), "{\"fontSize\":16}");
    }
}
