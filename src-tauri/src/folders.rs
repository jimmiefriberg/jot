use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::AppHandle;

use crate::windows;

/// Never shown, even with hidden files on: system clutter and version-control internals.
const ALWAYS_HIDDEN_NAMES: [&str; 2] = [".DS_Store", ".git"];
/// Folders Quick Open doesn't search: dependencies and build output are huge and rarely what you want to edit.
const SKIPPED_SEARCH_FOLDERS: [&str; 4] = ["node_modules", "target", "dist", "build"];
const MAXIMUM_SEARCH_FILES: usize = 20_000;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    name: String,
    path: String,
    is_directory: bool,
}

fn is_listed(name: &str, include_hidden: bool) -> bool {
    if ALWAYS_HIDDEN_NAMES.contains(&name) {
        return false;
    }
    include_hidden || !name.starts_with('.')
}

fn file_name_of(path: &Path) -> String {
    path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default()
}

/// Lists a folder for the sidebar: folders first, then files, alphabetically.
/// Hidden entries (starting with ".") are left out unless `include_hidden` is set.
#[tauri::command]
pub fn read_directory(path: String, include_hidden: Option<bool>) -> Result<Vec<DirectoryEntry>, String> {
    let include_hidden = include_hidden.unwrap_or(false);
    let mut entries: Vec<DirectoryEntry> = fs::read_dir(Path::new(&path))
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            if !is_listed(&name, include_hidden) {
                return None;
            }
            // Follow symlinks so linked folders still expand.
            let is_directory = fs::metadata(entry.path()).map(|metadata| metadata.is_dir()).unwrap_or(false);
            Some(DirectoryEntry { name, path: entry.path().to_string_lossy().into_owned(), is_directory })
        })
        .collect();
    entries.sort_by(|first, second| {
        second
            .is_directory
            .cmp(&first.is_directory)
            .then_with(|| first.name.to_lowercase().cmp(&second.name.to_lowercase()))
    });
    Ok(entries)
}

/// Every file under a folder (for Quick Open), skipping hidden entries and dependency/build folders.
#[tauri::command]
pub fn list_folder_files(path: String, include_hidden: Option<bool>) -> Vec<String> {
    let include_hidden = include_hidden.unwrap_or(false);
    let mut files = Vec::new();
    let mut pending_folders = vec![PathBuf::from(path)];
    while let Some(folder) = pending_folders.pop() {
        let Ok(entries) = fs::read_dir(&folder) else { continue };
        for entry in entries.filter_map(Result::ok) {
            let name = entry.file_name().to_string_lossy().into_owned();
            if !is_listed(&name, include_hidden) {
                continue;
            }
            // Symlinked folders are skipped here, so links that point back up the tree can't loop forever.
            let Ok(file_type) = entry.file_type() else { continue };
            if file_type.is_dir() {
                if !SKIPPED_SEARCH_FOLDERS.contains(&name.as_str()) {
                    pending_folders.push(entry.path());
                }
                continue;
            }
            files.push(entry.path().to_string_lossy().into_owned());
            if files.len() >= MAXIMUM_SEARCH_FILES {
                return files;
            }
        }
    }
    files
}

/// Creates an empty file. Fails when something with that name already exists.
#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map(|_| ())
        .map_err(|error| match error.kind() {
            std::io::ErrorKind::AlreadyExists => format!("“{}” already exists.", file_name_of(Path::new(&path))),
            _ => error.to_string(),
        })
}

#[tauri::command]
pub fn create_folder(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if path.exists() {
        return Err(format!("“{}” already exists.", file_name_of(&path)));
    }
    fs::create_dir(&path).map_err(|error| error.to_string())
}

/// Renames a file or folder, then updates every window that shows it.
#[tauri::command]
pub fn rename_path(app: AppHandle, from: String, to: String) -> Result<(), String> {
    let from = PathBuf::from(from);
    let to = PathBuf::from(to);
    // A case-only rename ("notes.md" → "Notes.md") reports the target as existing on case-insensitive disks.
    let is_case_change = from.to_string_lossy().to_lowercase() == to.to_string_lossy().to_lowercase();
    if to.exists() && !is_case_change {
        return Err(format!("“{}” already exists.", file_name_of(&to)));
    }
    fs::rename(&from, &to).map_err(|error| error.to_string())?;
    windows::handle_path_renamed(&app, &from, &to);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_directory(name: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!("text-editor-plus-folder-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        directory
    }

    fn listed_names(directory: &Path, include_hidden: bool) -> Vec<(String, bool)> {
        read_directory(directory.to_string_lossy().into_owned(), Some(include_hidden))
            .unwrap()
            .into_iter()
            .map(|entry| (entry.name, entry.is_directory))
            .collect()
    }

    #[test]
    fn lists_folders_first_and_skips_hidden_entries() {
        let directory = temporary_directory("listing");
        fs::create_dir_all(directory.join("notes")).unwrap();
        fs::write(directory.join("b.md"), "").unwrap();
        fs::write(directory.join("A.txt"), "").unwrap();
        fs::write(directory.join(".env"), "").unwrap();
        fs::write(directory.join(".DS_Store"), "").unwrap();

        assert_eq!(listed_names(&directory, false), vec![("notes".into(), true), ("A.txt".into(), false), ("b.md".into(), false)]);
        assert_eq!(
            listed_names(&directory, true),
            vec![("notes".into(), true), (".env".into(), false), ("A.txt".into(), false), ("b.md".into(), false)]
        );
    }

    #[test]
    fn lists_nested_files_but_skips_dependency_folders() {
        let directory = temporary_directory("search");
        fs::create_dir_all(directory.join("docs/guides")).unwrap();
        fs::create_dir_all(directory.join("node_modules/package")).unwrap();
        fs::write(directory.join("docs/guides/setup.md"), "").unwrap();
        fs::write(directory.join("node_modules/package/index.js"), "").unwrap();
        fs::write(directory.join("readme.md"), "").unwrap();

        let mut files = list_folder_files(directory.to_string_lossy().into_owned(), None);
        files.sort();
        let relative: Vec<_> = files.iter().map(|file| file.trim_start_matches(&*directory.to_string_lossy()).to_string()).collect();
        assert_eq!(relative, vec!["/docs/guides/setup.md", "/readme.md"]);
    }

    #[test]
    fn creates_files_without_overwriting() {
        let directory = temporary_directory("create");
        let path = directory.join("new.md").to_string_lossy().into_owned();
        create_file(path.clone()).unwrap();
        fs::write(&path, "keep me").unwrap();
        assert!(create_file(path.clone()).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "keep me");
    }
}
