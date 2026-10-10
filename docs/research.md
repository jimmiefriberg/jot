# Research: alternatives and stack

_October 2026_

## What exists today

| App | Stack | Good at | Why it isn't the answer |
| --- | --- | --- | --- |
| **TextEdit** (built in) | AppKit | Instant, always there | RTF-first, no Markdown, no JSON/CSV views, no code-editor line ops |
| **CotEditor** | Swift / AppKit | Very fast native plain-text editor, syntax highlighting | No rendered Markdown, no JSON tree, no CSV table |
| **MarkEdit** | Swift shell + CodeMirror 6 | "TextEdit for Markdown", GFM, light | Markdown only. Also shows a native shell + CodeMirror 6 works well |
| **Edmund** | AppKit / TextKit 2 | Native inline Markdown preview | Markdown only, beta |
| **Typora / iA Writer / Obsidian** | Electron / native | Polished Markdown writing | Markdown only. Obsidian is a whole vault/knowledge app |
| **BBEdit / Sublime Text / Nova** | Native / custom | Powerful editors | Too much IDE. No formatted JSON/CSV views. Paid |
| **Zed** | Rust + GPUI | Very fast | A full IDE. Its Markdown preview is a side panel and it has no CSV table |
| **Gridka / Easy CSV Editor / TableTool / Tablecruncher** | Native | CSV tables | CSV only |

**Gap:** nothing combines a fast TextEdit-style "open anything small" app with *formatted ⇄ plain* views for `.md`, `.json(c)` and `.csv` in the same app. Today that takes 3–4 apps.

## Stack options

| Option | Speed | Linux later | Effort to reach the feature set | Verdict |
| --- | --- | --- | --- | --- |
| Swift + AppKit (TextKit 2) | Best | ✗ | High. Markdown rendering, JSON tree and CSV grid all built by hand | Mac only, so it fails the Linux goal |
| Rust + GPUI (Zed's UI framework) | Best | ✓ | Very high. GPUI is pre-1.0 with frequent breaking changes, and its text editor lives inside Zed, not GPUI | Too much framework risk for a small app |
| Rust + egui / iced | Good | ✓ | High. Weak text editing widgets (IME, multi-cursor, accessibility) | Text editing quality isn't good enough |
| Electron + CodeMirror | OK | ✓ | Low | 150 MB+ bundle and slow cold start. Not "fast like Zed" |
| **Tauri 2 (Rust) + CodeMirror 6** | Good. Small native binary using the system WebView | ✓ (WebKitGTK) | **Low.** CodeMirror already ships line move/copy, multi-cursor, search, undo history and folding | **Chosen** |

### Why Tauri 2 + CodeMirror 6

- **Small and quick.** The app is a ~10 MB bundle on the system WKWebView, with no bundled Chromium. Windows open hidden and appear once the first frame is painted, so there's no white flash.
- **CodeMirror 6** handles documents with millions of lines and has every code-editor feature we want built in (Option+↑/↓ to move lines, Cmd+D, rectangular selection, search). MarkEdit is proof the approach works on Mac.
- **Linux** works through WebKitGTK with the same code. Only the packaging differs.
- **Rust** owns the native parts: menus, file I/O, open-with, file associations and settings on disk.
- **TypeScript + React** matches your day-to-day stack, so it's easy to maintain.

Versions used: Tauri 2.12, CodeMirror 6, React 19, Zustand 5, markdown-it 15, jsonc-parser 3, PapaParse 5, Vite 8, Bun.

## Sources
- MarkEdit: https://github.com/MarkEdit-app/MarkEdit
- GPUI (pre-1.0, breaking changes): https://github.com/Glass-HQ/gpui
- Markdown editors overview: https://www.hongkiat.com/blog/best-free-macos-markdown-apps/
- Mac CSV editors: https://apps.apple.com/app/gridka/id6759612463, https://apps.apple.com/app/id1171346381
