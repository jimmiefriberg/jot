// Sample documents used when the UI runs in a plain browser (development and smoke tests), where there is no file system.

const SAMPLE_DOCUMENTS: Record<string, string> = {
  md: `# Weekly notes

Quick notes and a **to-do list**, with _emphasis_, \`inline code\` and a [link](https://example.com).
Jump to the [reading list](#reading-list).

## To do
- [x] Ship the spec
- [ ] Build the CSV view
- [ ] Pick a theme

> Simple and readable above all.

| Tool | Use |
| --- | --- |
| Text Editor Plus | Notes |

\`\`\`json
{ "hello": "world" }
\`\`\`

## Reading list

1. *A Philosophy of Software Design*
2. *The Pragmatic Programmer*

### Later

- Revisit the theme colours
`,
  json: `{
  // Comments are fine
  "name": "text-editor-plus",
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
<project name="text-editor-plus" version="0.1.0">
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
