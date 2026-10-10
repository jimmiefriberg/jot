import { expect, test } from 'bun:test';

import { fontFamilyFor } from './fonts';

test('known fonts get their own fallback stack', () => {
  expect(fontFamilyFor('preview', 'Times')).toBe('"Times New Roman", Times, serif');
  expect(fontFamilyFor('editor', 'JetBrains Mono')).toStartWith('"JetBrains Mono Variable"');
});

test('any other installed font is quoted and given fallbacks for its role', () => {
  expect(fontFamilyFor('editor', 'Berkeley Mono')).toBe('"Berkeley Mono", ui-monospace, Menlo, monospace');
  expect(fontFamilyFor('preview', 'My "Font"')).toStartWith('"My Font", ');
});
