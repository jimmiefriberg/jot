# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The author, plus friends and colleagues they share the signed macOS build with, mostly developers and other technical people. They reach for Jot many times a day for small jobs: jotting notes and to-do lists, fixing a config file, or checking what's inside a JSON, YAML, XML or CSV file. They open a file, do the job and move on.

## Product Purpose

Jot is a fast, small replacement for TextEdit. Every text file you'd want to glance at or tweak opens in one app, and data files open **formatted**: Markdown as an editable live preview, JSON/YAML/XML as collapsible trees and CSV as a table. ⌘E switches to plain text. Success means it replaces the three or four apps this used to take (TextEdit, a Markdown app, a JSON viewer, a CSV tool) and still feels instant.

## Positioning

Formatted and plain views of `.md`, `.json(c)`, `.yaml`, `.xml` and `.csv` in one small, fast app, all backed by one document, so undo works across both views. It is deliberately **not** an IDE: no projects, no language server (LSP), no extensions. Competitors either cover one format (MarkEdit, Typora, the CSV tools) or are full IDEs (Zed, BBEdit, Sublime). See `docs/research.md`.

## Operating Context

- A desktop app: Tauri 2 (Rust) with a web-view UI (React + CodeMirror 6). It ships for macOS first, and Linux (WebKitGTK) is planned with the same code.
- It opens from Finder (file associations, Open With), by dragging onto a window or the Dock icon, from Open Recent, or with Quick Open (⌘P) over a sidebar folder.
- Use is keyboard-heavy and follows code-editor conventions (line moves, multi-cursor, ⌘-click on links). The native menu owns most shortcuts.
- One document per window; documents open as macOS native tabs of the front window. A separate Settings window has five tabs (General, Themes, Editor, Files, Shortcuts).
- The full behaviour is in `SPEC.md`, which is the source of truth for features.

## Capabilities and Constraints

- File kinds: Text, Markdown, JSON/JSONC, YAML, XML, CSV/TSV. Any other text file opens as plain text.
- One source of truth: the CodeMirror document. Trees and tables read from it and edit it through transactions.
- 21 built-in themes (light and dark), user-duplicated custom themes, an editor font and a writing font (Inter, JetBrains Mono, Fira Code and Source Serif are bundled), writing modes (typewriter scrolling, focus mode, text width).
- Atomic saves, crash-recovery drafts, reopening windows at launch, reloading on external changes, LF/CRLF kept as they are. Files are UTF-8 only, and files over 50 MB are refused.
- Performance targets: cold start to a visible window under 300 ms on Apple Silicon, one-frame typing latency, and formatted views computed lazily.
- **Platform-neutral UI:** native behaviour where the OS provides it (menus, tabs, dialogs, shortcuts), but the window content must look and work the same on macOS and Linux. Don't depend on Mac-only styling.
- Out of scope for v1: in-window tabs, deleting from the sidebar, LSP/autocomplete, rich text, saving in encodings other than UTF-8, plugins, auto-saving to the file itself.

## Brand Commitments

- Name: **Jot**. It was previously called *Text Editor Plus*, and old app data is migrated on first launch.
- App icon set in `src-tauri/icons/`.
- Voice in UI copy and docs: plain, short, everyday words. Messages say what happened and what to do, e.g. "That file is open in another window. Close it there first."

## Evidence on Hand

- `SPEC.md` (features), `docs/research.md` (alternatives and stack choice), `README.md` (develop, build, release).
- Browser sample documents for development: `bun run dev`, then `http://localhost:1420/?sample=md|json|csv|yml|xml|txt`, plus `&folder` for the sidebar and `?settings` for Settings.
- There are no testimonials, user numbers, press, pricing or download page. Future work must not invent them.

## Product Principles

1. **Speed and smallness win.** When a feature costs start-up time, typing latency or bundle size, the feature loses. The aim is TextEdit, but better, not an IDE.
2. **Open anything small, see it properly.** Formatted views are the default and plain text is always one keystroke away. Both are views of the same document.
3. **Never lose the user's text.** Saves are atomic, drafts survive crashes, and external changes are detected. Data safety outranks convenience.
4. **Behave like a desktop app, look the same everywhere.** Native menus, tabs and dialogs, with window content that is the same on every OS.

## Accessibility & Inclusion

Screen-reader support is not a goal. Don't add ARIA wiring or screen-reader work unless the user asks for it. Keyboard use is a goal, for speed: shortcuts, sensible focus order and visible focus.
