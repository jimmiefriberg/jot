import { expect, test } from 'bun:test';

import { emojiForShortcode, findFrontMatter, readAlertKind } from './markdown-features';

test('reads GitHub alert markers', () => {
  expect(readAlertKind('> [!NOTE]')).toBe('note');
  expect(readAlertKind('>[!warning]  ')).toBe('warning');
  expect(readAlertKind('> [!NOTE] with text after')).toBeNull();
  expect(readAlertKind('> Just a quote')).toBeNull();
});

test('finds YAML front matter only at the very start', () => {
  const note = '---\ntitle: Weekly notes\ntags: [work]\n---\n\n# Weekly notes';
  expect(findFrontMatter(note)).toEqual({ from: 0, to: note.indexOf('\n\n') });
  expect(findFrontMatter('# Title\n\n---\nnot: front matter\n---')).toBeNull();
  expect(findFrontMatter('---\nunclosed: true\n')).toBeNull();
});

test('looks up GitHub emoji shortcodes', () => {
  expect(emojiForShortcode('tada')).toBe('🎉');
  expect(emojiForShortcode('+1')).toBe('👍');
  expect(emojiForShortcode('constructor')).toBeNull();
  expect(emojiForShortcode('not_an_emoji')).toBeNull();
});
