// Sample documents used when the UI runs in a plain browser (development and smoke tests), where there is no file system.

const SAMPLE_DOCUMENTS: Record<string, string> = {
  md: `---
title: Weekly notes
tags: [planning, jot]
---

# Weekly notes

Quick notes and a **to-do list**, with _emphasis_, ~~strikethrough~~, ==highlights==, \`inline code\` and a [link](https://example.com). Press <kbd>⌘</kbd> <kbd>K</kbd> for links :rocket:
Jump to the [reading list](#reading-list), or see the footnote.[^jot]

## To do
- [x] Ship the spec
- [ ] Build the CSV view, and make sure long items wrap neatly under their own text instead of under the checkbox
- [ ] Pick a theme
  - [ ] Try Tokyo Night
  - [ ]

1. First step
2. Second step
   - A nested bullet

> Simple and readable above all.

> [!TIP]
> Alerts work like on GitHub: NOTE, TIP, IMPORTANT, WARNING and CAUTION.

> [!WARNING]
> Back up before you migrate.

| Tool | Use | Cost |
| :--- | :--- | ---: |
| Jot | Notes | $0 |
| Spreadsheet | Numbers | $12 |

The area of a circle is $A = \\pi r^2$, and it costs $5 and $10 to print.

$$
e^{i\\pi} + 1 = 0
$$

\`\`\`ts
// Code blocks are highlighted in their language.
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

\`\`\`mermaid
flowchart LR
  Idea[Jot it down] --> Draft{Good enough?}
  Draft -- yes --> Ship[Share it]
  Draft -- no --> Idea
\`\`\`

## Reading list

1. *A Philosophy of Software Design*
2. *The Pragmatic Programmer*

### Later

- Revisit the theme colours

---

[^jot]: Footnotes are numbered in the order you reference them.
`,
  json: `{
  // Comments are fine
  "name": "jot",
  "version": "0.1.0",
  "private": true,
  "keywords": ["editor", "markdown", "csv"],
  "author": null,
  "settings": {
    "fontSize": 14,
    "theme": { "light": "paper", "dark": "ink" },
  },
}
`,
  csv: `Name,Role,Notes
Ada Lovelace,Mathematician,"Wrote the first algorithm intended for a machine, and saw that computers could do more than calculate."
Grace Hopper,Computer scientist,Popularised machine-independent programming languages.
Alan Turing,Mathematician,"Formalised algorithms and computation with the Turing machine."
`,
  yml: `# Deploy config
name: deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    timeout: 10
    enabled: true
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - run: bun test
`,
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<!-- Build settings -->
<project name="jot" version="0.1.0">
  <dependency id="tauri" optional="false">Tauri 2</dependency>
</project>
`,
  txt: `Plain text notes.
Move this line with Option+Up/Down.
`,
};

export const BROWSER_SAMPLE_FOLDER = '/samples';

/** A small fake folder tree for the browser: every sample at the top, plus a nested folder. */
export function getBrowserSampleDirectory(path: string) {
  const files = Object.keys(SAMPLE_DOCUMENTS).map((extension) => ({
    name: `example.${extension}`,
    path: `${path}/example.${extension}`,
    isDirectory: false,
  }));
  if (path !== BROWSER_SAMPLE_FOLDER) return files.slice(0, 2);
  return [{ name: 'notes', path: `${path}/notes`, isDirectory: true }, ...files];
}

/** Every sample file, as Quick Open would list a folder. */
export function getBrowserSampleFiles(path: string): string[] {
  const files = Object.keys(SAMPLE_DOCUMENTS).map((extension) => `${path}/example.${extension}`);
  return [...files, `${path}/notes/example.md`, `${path}/notes/example.json`];
}

export function getBrowserSampleDocument(path: string): string | null {
  const extension = path.slice(path.lastIndexOf('.') + 1);
  return SAMPLE_DOCUMENTS[extension] ?? null;
}

/** A few menu commands so the Shortcuts settings can be tried in the browser. */
export const BROWSER_SAMPLE_MENU_COMMANDS = [
  { id: 'file.save', label: 'Save', menu: 'File', defaultShortcut: 'CmdOrCtrl+S' },
  { id: 'file.quickOpen', label: 'Quick Open…', menu: 'File', defaultShortcut: 'CmdOrCtrl+P' },
  { id: 'selection.deleteLine', label: 'Delete Line', menu: 'Selection', defaultShortcut: 'CmdOrCtrl+Shift+K' },
  { id: 'table.insertRowAbove', label: 'Insert Row Above', menu: 'Table', defaultShortcut: null },
  { id: 'table.insertColumnLeft', label: 'Insert Column Left', menu: 'Table', defaultShortcut: null },
  { id: 'view.wordWrap', label: 'Toggle Word Wrap', menu: 'View', defaultShortcut: 'Alt+Z' },
];
