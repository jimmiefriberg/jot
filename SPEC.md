# Text Editor Plus — Spec

A fast, small TextEdit replacement for notes, to-do lists, quick config fixes and previewing data files. It is **not** an IDE: no projects, no LSP, no extensions.

Stack and reasoning: see [docs/research.md](docs/research.md). **Tauri 2 (Rust) + CodeMirror 6 + React/TypeScript.** macOS first; Linux kept possible.

## 1. File types and views

| Kind | Extensions | Formatted view | Plain view |
| --- | --- | --- | --- |
| Text | `.txt`, `.text`, `.log`, unknown and untitled | none (plain only) | CodeMirror |
| Markdown | `.md`, `.markdown`, `.mdown` | **Editable live preview**: markup hides outside the line you're on; headings, emphasis, lists, quotes, code, links, images, tables and **clickable checkboxes** render in place. Typing `## ` makes a heading straight away | CodeMirror with Markdown highlighting (headings larger, bold/italic styled) |
| JSON | `.json`, `.jsonc`, `.json5`*, `.code-workspace` | Collapsible tree with type-coloured values, item counts, expand/collapse all. Comments and trailing commas allowed. **Double-click a value or key to edit it** | CodeMirror with JSON highlighting, code folding, **Format Document** |
| CSV | `.csv`, `.tsv` | Table: resizable columns, wrapped cell text with growing row height, sticky header | CodeMirror plain |
| YAML | `.yml`, `.yaml` | Collapsible tree in YAML notation (typed, coloured values; `---` documents as a list). Double-click to edit values and keys | CodeMirror with YAML highlighting, folding, ⌘/ comments |
| XML | `.xml`, `.plist`, `.svg`, `.xsd`, `.xsl(t)` | Collapsible element tree with attributes; text-only elements inline; missing/mismatched tags reported. Double-click to edit text and attribute values | CodeMirror with XML highlighting, folding, ⌘/ comments |

Any other text file (`.env`, `.toml`, `.ini`, `.sh`, no extension…) opens as plain text via File → Open ("All files"), drag-and-drop or Open With.

\* `.json5` opens with the JSONC parser and works best-effort.

- **Formatted is the default** for md/json/csv/yaml/xml (configurable per kind in Settings). `Cmd+E` toggles Formatted ⇄ Plain. The status bar has a segmented control for the same switch.
- The kind name in the status bar is a menu: pick another kind to show the document as Markdown, JSON… without renaming it.
- **One source of truth:** the CodeMirror document. Markdown's formatted view *is* the editor (with live-preview decorations); the tree and table views read from it, and every edit made in them is a CodeMirror transaction. **Undo/redo works across both views.**
- In the trees, double-clicking an editable value edits it in place (types and quoting are preserved; comments untouched); double-clicking anything else jumps to that line in Plain view. In Markdown, ⌘-click opens a link.
- If JSON doesn't parse, the formatted view shows the error with line and column plus a "Show in source" button.
- Untitled documents are Text. "Save As" with a `.md`/`.json`/`.csv` name switches the kind.
- **Format → Convert to JSON / YAML / CSV** turns a data document into another format in a new untitled window (a JSON or YAML list of objects becomes a table; a CSV with a header row becomes a list of objects).

## 2. Editing features (Plain view)

Everything you'd expect from TextEdit, plus the code-editor basics:

| Action | Shortcut |
| --- | --- |
| Cut / Copy / Paste / Select All | ⌘X ⌘C ⌘V ⌘A. Cut/copy with no selection takes the whole line |
| Undo / Redo | ⌘Z / ⇧⌘Z |
| Move line(s) up / down | ⌥↑ / ⌥↓ |
| Copy line(s) up / down | ⇧⌥↑ / ⇧⌥↓ |
| Insert line above / below | ⇧⌘↩ / ⌘↩ |
| Delete line | ⇧⌘K |
| Select line (repeat to extend) | ⌘L |
| Add next occurrence / select all occurrences | ⌘D / ⇧⌘L |
| Add cursor above / below | ⌥⌘↑ / ⌥⌘↓ |
| Rectangular selection | ⌥-drag |
| Indent / Outdent | ⌘] / ⌘[ |
| Toggle comment (JSONC) | ⌘/ |
| Find / Replace / Find next / previous | ⌘F / ⌥⌘F / ⌘G / ⇧⌘G |
| Go to line | ⌃G |
| Format JSON document | ⇧⌥F |
| Toggle word wrap (this window) | ⌥Z |
| Zoom in / out / reset (this window) | ⌘= / ⌘- / ⌘0 |
| Bold / italic / inline code / link (Markdown) | ⌘B / ⌘I / ⇧⌘C / ⌘K |
| Make upper / lower case, capitalize words | Format menu |
| Sort lines (selection, or whole document) | Format menu |
| Remove trailing whitespace | Format menu |
| Quick Open | ⌘P |

Find in the JSON/YAML/XML tree and the CSV table filters the view instead (see below); other search commands switch to Plain view.

**View options:** invisible characters (spaces and tabs), **typewriter scrolling** (the cursor's line stays in the middle), **focus mode** (everything but the current paragraph fades), and a **text width** for Plain view (a centred column of 60–120 characters).

## 3. CSV table (Formatted view)

Kept deliberately simple:

- Column widths are draggable on the header edge, default 180 px, and kept for the session. Cell text always wraps and rows grow to fit.
- The first row is shown as a sticky bold header (toggle in Settings).
- **Selection:** click a cell, click a row number to select a row, click a column letter to select a column. Shift-click extends a row or column selection.
- **Move:** ⌥↑/⌥↓ moves the selected rows. ⌥←/⌥→ moves the selected columns. With only a cell selected, these move that cell's row or column.
- **Edit:** double-click or ↩ to edit a cell. ↩ commits and ⎋ cancels. Arrow keys move between cells. ⌫ clears the selected cell(s).
- **Insert:** ⌘↩ / ⇧⌘↩ inserts a row below/above. *Table* menu: insert column left/right, delete row(s)/column(s).
- **Copy/Cut/Paste:** copy puts the selected rows/columns/cell on the clipboard as delimited text. Paste into a cell sets its value.
- **Sort:** select a column (or a cell in it), then use the toolbar's sort buttons or *Table → Sort by Column*. The header row stays put; numbers sort by value and empty cells go last. Undoable.
- **Filter:** ⌘F (or *Table → Filter Rows…*) focuses the filter box; only rows with a matching cell are shown. ↩ jumps to the first match, ⎋ clears it.
- Cells use the writing font; columns of numbers are right-aligned. Column widths are remembered per file; double-click a column edge to fit it to its contents.
- The status bar shows the number of rows and columns.
- The delimiter (comma, tab, semicolon…) and line endings are detected and kept on save. An edit only changes the text that actually differs, so the rest of the file stays byte for byte as it was.
- Big files: rows use `content-visibility: auto`, and the first 2,000 rows render with a "Show more" button.

## 4. Markdown (Formatted view = live preview)

- The same editor as Plain view, so every editing feature and shortcut works. Markup (`#`, `**`, `>`, `-`, link URLs) is hidden except on the line (or span) the cursor is in, where it shows for editing.
- Typing Markdown applies it immediately (`## ` → heading, `**bold**`, `- [ ] ` → checkbox, `---` → rule).
- Task checkboxes toggle with a click. Tables and images render until the cursor moves into them.
- ⌘-click opens links (web links in the browser, relative `.md` links in a new window, `#heading` links jump to that heading). Relative images resolve against the file's folder.
- **Images:** pasting an image (a screenshot, say) saves it to an `images` folder next to the note and links it. Dropping image files on a note links them where they land (relative to the note).
- **Outline:** *View → Show Outline* (⌥⌘O) or the status-bar list button shows the note's headings in the sidebar; click one to jump to it. The heading you're in is highlighted.
- ↩ continues lists and quotes; ⌘B / ⌘I / ⌘K wrap the selection (or the word at the cursor) in bold, italic or a link.
- Prose uses the *preview font* from Settings; code uses the editor font.

## 5. JSON (Formatted view)

- Parsed with `jsonc-parser`, so comments and trailing commas are fine.
- Objects and arrays expand to depth 2 by default. Collapsed nodes show `{ 3 keys }` / `[ 12 items ]`.
- Expand All / Collapse All in the *View* menu and in the view's toolbar.
- Large containers render 500 children, then "Show more".
- Double-click a value or key to edit it in place. Strings stay strings, numbers/booleans/null can be typed as such; comments and formatting elsewhere are untouched. Structural edits (adding/removing members) happen in Plain view, which supports folding and Format Document (comments are kept).
- **Filter** (⌘F, also in YAML and XML): matching keys and values are highlighted and their containers expanded; ↩ / ⇧↩ (or ⌘G / ⇧⌘G) step through matches.
- Click a row to select it; the toolbar shows its path (`settings.theme.light`, `steps[0].name`) and copies it on click.

## 6. Theming and settings

Opened with ⌘, in its own window, with four tabs. Changes apply at once in this window and reach every other window (and `<app config dir>/settings.json`, written atomically) a moment after you stop typing or dragging.

- **General:** appearance (System / Light / Dark), reopen windows from last time, sidebar side.
- **Themes:** a card with a small preview for every theme; pick one for light and one for dark. Built in: *Paper*, *Sepia*, *GitHub Light*, *Tokyo Night Day*, *Catppuccin Latte*, *Solarized Light*, *Gruvbox Light*, *Rosé Pine Dawn* (light) and *Ink*, *Midnight*, *Tokyo Night*, *Catppuccin Frappé / Macchiato / Mocha*, *Dracula*, *Nord*, *One Dark*, *GitHub Dark*, *Solarized Dark*, *Gruvbox Dark*, *Rosé Pine* (dark). Under *Customize colours*, **Duplicate** any theme and edit every colour, rename or delete it. Deleting the theme in use falls back to the default.
- **Editor:** editor font and writing font, picked by name (fallbacks are added behind the scenes; *Other…* takes any installed font). Inter, JetBrains Mono, Fira Code and Source Serif are bundled, so they work without being installed. Font size, line height, word wrap, text width, tab size, line numbers, current-line highlight, invisible characters, typewriter scrolling, focus mode.
- **Files:** default view per kind (Formatted/Plain), CSV first row as header, remove trailing spaces and end files with a newline on save (Markdown line breaks and CSV are left alone), show hidden files in the sidebar.

## 7. Window and document behaviour (TextEdit-like)

- One window per document. Windows join macOS native tabs (*Window → Merge All Windows*, or system "prefer tabs").
- New ⌘N, Open ⌘O (multi-select), **Open Recent** (files and folders, newest first, with *Clear Menu*), Save ⌘S, Save As ⇧⌘S, Revert to Saved, Close ⌘W.
- **Quick Open** ⌘P: type part of a file name to find it among recent files and every file in the sidebar folder (dependency and build folders are skipped). ↩ opens it in this window, ⌘↩ in a new one.
- **Reopen windows:** files and folders open at quit come back at the next launch (unless the app was opened with a file, or it's turned off in Settings).
- **Crash recovery:** unsaved changes are written to a draft a moment after you stop typing. If the app quits unexpectedly, the next launch reopens those windows with the changes in place (unsaved, so you choose whether to keep them).
- Opening a file that's already open focuses its window.
- Open via Finder (file associations, "Open With"), drag-and-drop onto a window, or CLI arguments (Linux).
- The title shows the file name, plus "— Edited" when there are unsaved changes.
- Closing a dirty window asks Save / Don't Save / Cancel. Quit (⌘Q) goes through the windows one at a time, bringing each to the front before it asks; Cancel stops the quit.
- **External changes:** when a window gets focus, the file's modified time is checked. A clean document reloads silently. A dirty one asks before reloading. Saving checks again, and asks before replacing changes another app made since the file was opened.
- Save As refuses a file that's open in another window (that window would otherwise show stale text).
- Line endings (LF/CRLF) are preserved. Files are UTF-8, and other encodings are shown with replacement characters plus a warning.
- Saves are atomic (write to a temp file, flush it to disk, then rename).
- The app stays running with no windows open on macOS and quits on Linux.

### Folders

- **File → Open Folder…** (⇧⌘O), dropping a folder on a window, or opening a folder from Finder/the command line shows it in a **sidebar on the left** (switchable to the right with the ⇄ button, *View → Move Sidebar to Other Side*, or Settings; applies to all windows). Toggle it with **⌘\\** or the status-bar sidebar button; close it with ×. For Markdown, the sidebar has *Files* and *Outline* tabs.
- Folders first, then files, alphabetically, each with an icon for its kind; hidden entries (`.env`, `.gitignore`…) are left out unless *Show hidden files* is on (`.git` and `.DS_Store` never show). Folders load when expanded.
- Keyboard: ↑/↓ move between rows, → opens a folder (or steps into it), ← closes it (or goes to its parent), ↩ opens.
- Right-click (or the + button) for **New File…**, **New Folder…**, **Rename…**, **Reveal in Finder**, **Copy Path** and *Open in New Window*. Names are typed in place. Renaming a file that's open updates its window.
- Click a file to open it **in this window** (asks about unsaved changes first). ⌘-click opens it in a new window that shows the same folder. If the file is already open in another window, that window comes to the front.
- The current file is highlighted and its folders are expanded. Listings refresh when the window gets focus (or with ↻).
- The sidebar width is draggable and remembered. Binary files are refused with a message instead of opening as garbage.

## 8. Performance targets

- Cold start to a visible window: < 300 ms on Apple Silicon. Windows open hidden and appear after the first paint, so no white flash.
- Typing latency equals CodeMirror's (one frame) for files up to ~50 MB.
- Formatted views are computed lazily, only while visible and only when the document revision changes.

## 9. Architecture (see the source tree for the full list)

```
src-tauri/            Rust: menu, windows registry, file I/O, settings, quit flow
  src/lib.rs          app setup, startup (drafts, session, empty window), run loop
  src/menu.rs         native menu (incl. Open Recent) → "menu-action" event to the focused window
  src/files.rs        read / write (atomic, flushed) / modified time / pasted images
  src/folders.rs      list a folder, search a folder's files, create, rename
  src/recent.rs       recent files and folders (recent.json) for Open Recent and Quick Open
  src/session.rs      windows to reopen (session.json) and crash-recovery drafts
  src/windows.rs      open/focus document windows, registry (path + folder per window), quit one window at a time
  src/settings.rs     load / save settings.json, broadcast "settings-changed"
src/
  app/                EditorWindow, SettingsWindow roots
  components/         SourceEditor, DataTree (JSON/YAML), XmlTree, TreeView, CsvTable, Sidebar (files, outline),
                      QuickOpen, StatusBar, Settings/*, Icon, ErrorBoundary
  lib/documents/      file kinds, document store (Zustand), open/save/close actions, drafts, save cleanup
  lib/editor/         CodeMirror setup, theme, line and text commands, writing modes, live preview, image paste/drop
  lib/commands/       command bus: menu action → active view handler
  lib/convert/        JSON ⇄ YAML ⇄ CSV conversion (pure, tested)
  lib/csv/            parse / serialize / move / insert / delete / sort / filter (pure, tested)
  lib/json/ yaml/ xml/ tree/   tree models, in-place edits, tree search (pure, tested)
  lib/markdown/       markdown-it setup, paths, outline (pure, tested)
  lib/search/         fuzzy matching for Quick Open (pure, tested)
  lib/settings/       schema, defaults, fonts, theme presets, theme → CSS variables
  lib/folders/ sidebar/ window/ quick-open/   per-window UI state (Zustand) and folder actions
  lib/tauri/          typed backend bridge (plus a browser fallback for dev and testing)
```

**Command flow:** native menu item → Rust emits `menu-action { id }` to the focused window → the command bus runs the window-level commands (save, toggle view, undo…) or passes the command to the active view handler (CodeMirror or CSV table).

## 10. Out of scope (v1)

Tabs inside one window (native macOS tabs cover it), deleting files from the sidebar, LSP/autocomplete, spell-check beyond the system's (which is on for text and Markdown only), rich text, non-UTF-8 save, plugins, auto-save to the file itself (drafts cover crashes).

## 11. Testing

Value-driven unit tests (`bun test`) for the pure modules: CSV model, trees and tree search, conversions, outline, paths, fuzzy matching, text commands, minimal text changes, save cleanup, file kinds, fonts and settings merge. Rust tests (`cargo test --lib`) cover atomic saves, folder listing and search, recent items and drafts. The UI is checked by hand plus a browser-mode smoke run.
