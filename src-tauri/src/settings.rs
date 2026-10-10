use std::fs;
use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::files::write_atomically;

fn settings_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let directory = app.path().app_config_dir().map_err(|error| error.to_string())?;
    Ok(directory.join("settings.json"))
}

/// The stored settings as JSON, or None when there are none yet (or the file is unreadable).
pub fn read_settings<R: Runtime>(app: &AppHandle<R>) -> Option<Value> {
    let path = settings_path(app).ok()?;
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

/// Whether windows that were open at quit should come back at the next launch (on unless turned off in Settings).
pub fn should_reopen_windows<R: Runtime>(app: &AppHandle<R>) -> bool {
    read_settings(app)
        .and_then(|settings| settings.get("reopenWindowsOnLaunch").and_then(Value::as_bool))
        .unwrap_or(true)
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Option<Value> {
    read_settings(&app)
}

/// Saves settings and tells every window to apply them.
#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(directory) = path.parent() {
        fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    }
    let text = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    write_atomically(&path, text.as_bytes())?;
    app.emit("settings-changed", settings).map_err(|error| error.to_string())
}
