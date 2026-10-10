# Text Editor Plus

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
cp -R "src-tauri/target/release/bundle/macos/Text Editor Plus.app" /Applications/
```

To make it the default app, select a `.md`/`.json`/`.csv`/`.txt` file in Finder, press ⌘I, choose **Text Editor Plus** under "Open with" and click **Change All…**.

The app isn't code-signed, so on first launch you'll need to right-click it and choose **Open**.

## Linux (later)

The same code builds on Linux (WebKitGTK). Install the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux), then run `bun run app:build -- --bundles deb,appimage`.
