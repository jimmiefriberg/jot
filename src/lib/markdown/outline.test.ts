import { expect, test } from 'bun:test';

import { extractOutline, findCurrentHeading, slugifyHeading } from './outline';

const document = `# Weekly notes

Intro text
## To **do**
\`\`\`md
# not a heading
\`\`\`
Setext heading
--------------
## To do
`;

test('lists ATX and setext headings, skipping fenced code', () => {
  expect(extractOutline(document).map(({ level, text, lineIndex }) => ({ level, text, lineIndex }))).toEqual([
    { level: 1, text: 'Weekly notes', lineIndex: 0 },
    { level: 2, text: 'To do', lineIndex: 3 },
    { level: 2, text: 'Setext heading', lineIndex: 7 },
    { level: 2, text: 'To do', lineIndex: 9 },
  ]);
});

test('gives repeated headings unique GitHub-style anchors', () => {
  expect(extractOutline(document).map((heading) => heading.slug)).toEqual(['weekly-notes', 'to-do', 'setext-heading', 'to-do-1']);
  expect(slugifyHeading('What’s new in 2.0?')).toBe('whats-new-in-20');
});

test('finds the heading the cursor is under', () => {
  const headings = extractOutline(document);
  expect(findCurrentHeading(headings, 5)?.lineIndex).toBe(3);
  expect(findCurrentHeading(headings, 0)?.lineIndex).toBe(0);
});

test('skips YAML front matter', () => {
  const headings = extractOutline('---\ntitle: Notes\n---\n\n# Real heading');
  expect(headings.map((heading) => heading.text)).toEqual(['Real heading']);
});
