# Jot

A fast, small TextEdit replacement for notes, to-do lists, quick config fixes and previewing data files.
`.md`, `.json`/`.jsonc`, `.yaml`, `.xml` and `.csv` open **formatted** (live Markdown, collapsible trees, a CSV table). Press **⌘E** to switch to plain text, **⌘P** to find a file, **⌘,** for Settings (21 themes, fonts, writing modes).

- What it does: [SPEC.md](SPEC.md)
- Why this stack (Tauri 2 + CodeMirror 6): [docs/research.md](docs/research.md)

## Develop

Requires Bun and Rust.

```sh
bun install
bun run app:dev      # run the app with hot reload
bun run test         # TypeScript unit tests
bun run typecheck
(cd src-tauri && cargo test --lib)   # Rust tests
```

`bun run dev` runs the UI alone in a browser, using sample documents: `http://localhost:1420/?sample=md` (also `json`, `csv`, `yml`, `xml`, `txt`), add `&folder` for the sidebar, and `?settings` for the Settings window.

## Build and install (macOS)

```sh
bun run app:build -- --bundles app
cp -R "src-tauri/target/release/bundle/macos/Jot.app" /Applications/
```

To make it the default app, select a `.md`/`.json`/`.csv`/`.txt` file in Finder, press ⌘I, choose **Jot** under "Open with" and click **Change All…**.

That build isn't code-signed, so on first launch you'll need to right-click it and choose **Open**.

### Signed release

`bun run app:release` builds a signed and notarized `Jot.app` plus a DMG to share, then checks that macOS accepts it. It reads the signing settings from `~/.jot-signing.env` (kept out of the repo; see the top of `scripts/release-macos.sh` for the four variables) and needs the matching *Developer ID Application* certificate in your Keychain. Add `-- --target universal-apple-darwin` for a build that also runs on Intel Macs (after `rustup target add x86_64-apple-darwin`).

Jot used to be called *Text Editor Plus*. On first launch it copies that version's settings, recent files and drafts into its own folder, but you'll need to choose Jot as the default app again (above) and can then delete the old app.

## Linux (later)

The same code builds on Linux (WebKitGTK). Install the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux), then run `bun run app:build -- --bundles deb,appimage`.
