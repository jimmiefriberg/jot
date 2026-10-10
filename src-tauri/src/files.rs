use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};

const IMAGE_PATH_HEADER: &str = "x-path";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContents {
    contents: String,
    modified_time: Option<u64>,
    has_invalid_utf8: bool,
}

pub fn modified_time_of(path: &Path) -> Option<u64> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    let duration = modified.duration_since(UNIX_EPOCH).ok()?;
    Some(duration.as_millis() as u64)
}

/// Follows symlinks so saving replaces the target file, not the link.
fn resolve_target_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

/// Text files don't contain NUL bytes; images, archives and executables almost always do near the start.
fn looks_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(8000).any(|&byte| byte == 0)
}

/// Writes to a temporary sibling file, flushes it to disk and renames it over the target,
/// so a crash or power cut never leaves a half-written file.
pub fn write_atomically(path: &Path, contents: &[u8]) -> Result<(), String> {
    let target_path = resolve_target_path(path);
    let file_name = target_path
        .file_name()
        .ok_or("Invalid file path")?
        .to_string_lossy()
        .into_owned();
    let temporary_path = target_path.with_file_name(format!(".{file_name}.text-editor-plus-tmp"));

    let write_result = fs::File::create(&temporary_path).and_then(|mut file| {
        file.write_all(contents)?;
        file.sync_all()
    });
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temporary_path);
        return Err(error.to_string());
    }
    if let Ok(metadata) = fs::metadata(&target_path) {
        let _ = fs::set_permissions(&temporary_path, metadata.permissions());
    }
    if let Err(error) = fs::rename(&temporary_path, &target_path) {
        let _ = fs::remove_file(&temporary_path);
        return Err(error.to_string());
    }
    Ok(())
}

/// Decodes a `encodeURIComponent` string (used to pass a path in a request header).
fn decode_percent_encoding(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = text.get(index + 1..index + 3)?;
            decoded.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<FileContents, String> {
    let path = PathBuf::from(path);
    if path.is_dir() {
        return Err("This is a folder. Use File → Open Folder… to browse it.".into());
    }
    let bytes = fs::read(&path).map_err(|error| error.to_string())?;
    if looks_binary(&bytes) {
        return Err("This doesn't look like a text file.".into());
    }
    let (contents, has_invalid_utf8) = match String::from_utf8(bytes) {
        Ok(text) => (text, false),
        Err(error) => (String::from_utf8_lossy(error.as_bytes()).into_owned(), true),
    };
    Ok(FileContents {
        contents,
        modified_time: modified_time_of(&path),
        has_invalid_utf8,
    })
}

/// Saves a document atomically and returns its new modified time.
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<Option<u64>, String> {
    let path = PathBuf::from(path);
    write_atomically(&path, contents.as_bytes())?;
    Ok(modified_time_of(&resolve_target_path(&path)))
}

#[tauri::command]
pub fn file_modified_time(path: String) -> Option<u64> {
    modified_time_of(Path::new(&path))
}

/// Saves a pasted image. The bytes are the raw request body; the target path is in the `x-path` header.
/// Never overwrites an existing file.
#[tauri::command]
pub fn save_image(request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected image data.".into());
    };
    let path = request
        .headers()
        .get(IMAGE_PATH_HEADER)
        .and_then(|value| value.to_str().ok())
        .and_then(decode_percent_encoding)
        .map(PathBuf::from)
        .ok_or("Missing image path.")?;
    if path.exists() {
        return Err("A file with this name already exists.".into());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    write_atomically(&path, bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_directory(name: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!("text-editor-plus-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        directory
    }

    #[test]
    fn writes_atomically_and_reads_back_with_line_endings() {
        let directory = temporary_directory("roundtrip");
        let path = directory.join("note.md").to_string_lossy().into_owned();
        write_text_file(path.clone(), "a\r\nb\r\n".into()).unwrap();
        let read = read_text_file(path).unwrap();
        assert_eq!(read.contents, "a\r\nb\r\n");
        assert!(!read.has_invalid_utf8);
        assert!(read.modified_time.is_some());
        let leftovers: Vec<_> = fs::read_dir(&directory).unwrap().collect();
        assert_eq!(leftovers.len(), 1, "temporary file should be renamed away");
    }

    #[test]
    #[cfg(unix)]
    fn saving_through_a_symlink_keeps_the_link() {
        let directory = temporary_directory("symlink");
        let target = directory.join("real.txt");
        let link = directory.join("link.txt");
        fs::write(&target, "old").unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();
        write_text_file(link.to_string_lossy().into_owned(), "new".into()).unwrap();
        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(fs::read_to_string(&target).unwrap(), "new");
    }

    #[test]
    fn refuses_binary_files() {
        let directory = temporary_directory("binary");
        let path = directory.join("image.png");
        fs::write(&path, [0x89, 0x50, 0x4E, 0x47, 0x00, 0x01]).unwrap();
        assert!(read_text_file(path.to_string_lossy().into_owned()).is_err());
    }

    #[test]
    fn flags_invalid_utf8() {
        let directory = temporary_directory("latin1");
        let path = directory.join("latin1.txt");
        fs::write(&path, [0x63, 0x61, 0x66, 0xE9]).unwrap();
        let read = read_text_file(path.to_string_lossy().into_owned()).unwrap();
        assert!(read.has_invalid_utf8);
        assert_eq!(read.contents, "caf\u{FFFD}");
    }

    #[test]
    fn decodes_percent_encoded_paths() {
        assert_eq!(decode_percent_encoding("%2FUsers%2Fme%2Fa%20b%C3%A9.png").unwrap(), "/Users/me/a bé.png");
        assert!(decode_percent_encoding("%zz").is_none());
    }
}
