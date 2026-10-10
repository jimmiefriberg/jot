use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime};

use crate::files::write_atomically;
use crate::menu;

const RECENT_FILE_NAME: &str = "recent.json";
const MAXIMUM_RECENT_ITEMS: usize = 12;

/// Recently opened files and folders, newest first. Shown in File → Open Recent and in Quick Open.
#[derive(Default)]
pub struct RecentItems {
    paths: Mutex<Vec<PathBuf>>,
}

fn recent_file_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|directory| directory.join(RECENT_FILE_NAME))
}

fn store_recent_items<R: Runtime>(app: &AppHandle<R>, paths: &[PathBuf]) {
    let Some(file_path) = recent_file_path(app) else { return };
    if let Some(directory) = file_path.parent() {
        let _ = fs::create_dir_all(directory);
    }
    let strings: Vec<String> = paths.iter().map(|path| path.to_string_lossy().into_owned()).collect();
    if let Ok(text) = serde_json::to_string_pretty(&strings) {
        let _ = write_atomically(&file_path, text.as_bytes());
    }
}

fn rebuild_menu<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(app_menu) = menu::build_menu(app) {
        let _ = app.set_menu(app_menu);
    }
}

/// Adds or moves a path to the top of the list, newest first.
fn push_front(paths: &mut Vec<PathBuf>, path: &Path) {
    paths.retain(|existing| existing != path);
    paths.insert(0, path.to_path_buf());
    paths.truncate(MAXIMUM_RECENT_ITEMS);
}

/// Replaces `from` (or anything inside it) with the same path under `to`.
pub fn renamed_path(path: &Path, from: &Path, to: &Path) -> Option<PathBuf> {
    let relative = path.strip_prefix(from).ok()?;
    Some(if relative.as_os_str().is_empty() { to.to_path_buf() } else { to.join(relative) })
}

/// Reads the list saved by an earlier launch. Run once at startup.
pub fn load_recent_items<R: Runtime>(app: &AppHandle<R>) {
    let stored: Vec<String> = recent_file_path(app)
        .and_then(|file_path| fs::read_to_string(file_path).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default();
    let paths = stored.into_iter().map(PathBuf::from).take(MAXIMUM_RECENT_ITEMS).collect();
    *app.state::<RecentItems>().paths.lock().unwrap() = paths;
    rebuild_menu(app);
}

/// Recent files and folders that still exist, newest first.
pub fn recent_item_paths<R: Runtime>(app: &AppHandle<R>) -> Vec<PathBuf> {
    let paths = app.state::<RecentItems>().paths.lock().unwrap().clone();
    paths.into_iter().filter(|path| path.exists()).collect()
}

pub fn note_recent_item<R: Runtime>(app: &AppHandle<R>, path: &Path) {
    let paths = {
        let state = app.state::<RecentItems>();
        let mut paths = state.paths.lock().unwrap();
        if paths.first().map(PathBuf::as_path) == Some(path) {
            return;
        }
        push_front(&mut paths, path);
        paths.clone()
    };
    store_recent_items(app, &paths);
    rebuild_menu(app);
}

pub fn rename_recent_items<R: Runtime>(app: &AppHandle<R>, from: &Path, to: &Path) {
    let paths = {
        let state = app.state::<RecentItems>();
        let mut paths = state.paths.lock().unwrap();
        for path in paths.iter_mut() {
            if let Some(renamed) = renamed_path(path, from, to) {
                *path = renamed;
            }
        }
        paths.clone()
    };
    store_recent_items(app, &paths);
    rebuild_menu(app);
}

pub fn clear_recent_items<R: Runtime>(app: &AppHandle<R>) {
    app.state::<RecentItems>().paths.lock().unwrap().clear();
    store_recent_items(app, &[]);
    rebuild_menu(app);
}

/// Recent files (not folders) for Quick Open.
#[tauri::command]
pub fn get_recent_files(app: AppHandle) -> Vec<String> {
    recent_item_paths(&app)
        .into_iter()
        .filter(|path| path.is_file())
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_newest_first_without_duplicates() {
        let mut paths = vec![PathBuf::from("/a"), PathBuf::from("/b")];
        push_front(&mut paths, Path::new("/b"));
        assert_eq!(paths, vec![PathBuf::from("/b"), PathBuf::from("/a")]);
        for index in 0..20 {
            push_front(&mut paths, Path::new(&format!("/file-{index}")));
        }
        assert_eq!(paths.len(), MAXIMUM_RECENT_ITEMS);
        assert_eq!(paths[0], PathBuf::from("/file-19"));
    }

    #[test]
    fn renames_paths_inside_a_renamed_folder() {
        let from = Path::new("/notes/old");
        let to = Path::new("/notes/new");
        assert_eq!(renamed_path(Path::new("/notes/old"), from, to), Some(PathBuf::from("/notes/new")));
        assert_eq!(renamed_path(Path::new("/notes/old/a.md"), from, to), Some(PathBuf::from("/notes/new/a.md")));
        assert_eq!(renamed_path(Path::new("/notes/older/a.md"), from, to), None);
    }
}
