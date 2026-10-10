use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use crate::files::write_atomically;

const SESSION_FILE_NAME: &str = "session.json";
const DRAFTS_DIRECTORY_NAME: &str = "drafts";

/// One window that was open when the app quit, so it can come back at the next launch.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionWindow {
    pub path: Option<String>,
    pub folder: Option<String>,
}

/// Unsaved text of one window, written while editing so it survives a crash.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub id: String,
    pub path: Option<String>,
    pub text: String,
}

fn session_file_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|directory| directory.join(SESSION_FILE_NAME))
}

fn drafts_directory<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
    Ok(directory.join(DRAFTS_DIRECTORY_NAME))
}

/// Draft ids become file names, so only simple ids (like a UUID) are accepted.
fn is_valid_draft_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|character| character.is_ascii_alphanumeric() || character == '-')
}

pub fn save_session<R: Runtime>(app: &AppHandle<R>, windows: &[SessionWindow]) {
    let Some(file_path) = session_file_path(app) else { return };
    if let Some(directory) = file_path.parent() {
        let _ = fs::create_dir_all(directory);
    }
    if let Ok(text) = serde_json::to_string_pretty(windows) {
        let _ = write_atomically(&file_path, text.as_bytes());
    }
}

/// The windows saved at the last quit whose files and folders still exist.
pub fn load_session<R: Runtime>(app: &AppHandle<R>) -> Vec<SessionWindow> {
    let windows: Vec<SessionWindow> = session_file_path(app)
        .and_then(|file_path| fs::read_to_string(file_path).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default();
    windows
        .into_iter()
        .filter(|window| window.path.as_deref().or(window.folder.as_deref()).is_some_and(|path| PathBuf::from(path).exists()))
        .collect()
}

/// Drafts left behind by windows that never closed normally (a crash or force quit).
pub fn load_drafts<R: Runtime>(app: &AppHandle<R>) -> Vec<Draft> {
    let Ok(directory) = drafts_directory(app) else { return Vec::new() };
    let Ok(entries) = fs::read_dir(directory) else { return Vec::new() };
    entries
        .filter_map(Result::ok)
        .filter_map(|entry| fs::read_to_string(entry.path()).ok())
        .filter_map(|text| serde_json::from_str::<Draft>(&text).ok())
        .filter(|draft| is_valid_draft_id(&draft.id))
        .collect()
}

#[tauri::command]
pub fn write_draft(app: AppHandle, draft: Draft) -> Result<(), String> {
    if !is_valid_draft_id(&draft.id) {
        return Err("Invalid draft id".into());
    }
    let directory = drafts_directory(&app)?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let text = serde_json::to_string(&draft).map_err(|error| error.to_string())?;
    write_atomically(&directory.join(format!("{}.json", draft.id)), text.as_bytes())
}

#[tauri::command]
pub fn delete_draft(app: AppHandle, id: String) {
    if !is_valid_draft_id(&id) {
        return;
    }
    if let Ok(directory) = drafts_directory(&app) {
        let _ = fs::remove_file(directory.join(format!("{id}.json")));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_simple_draft_ids() {
        assert!(is_valid_draft_id("5f0c6a7e-1b2c-4d3e-8f9a-0b1c2d3e4f5a"));
        assert!(!is_valid_draft_id("../settings"));
        assert!(!is_valid_draft_id(""));
    }
}
