import { expect, test } from 'bun:test';

import { createMinimalChange, normalizeLineBreaks } from './text-change';

test('changes only the part that differs', () => {
  expect(createMinimalChange('a,b,c\n1,2,3\n', 'a,b,c\n1,9,3\n')).toEqual({ from: 8, to: 9, insert: '9' });
  expect(createMinimalChange('hello', 'hello world')).toEqual({ from: 5, to: 5, insert: ' world' });
  expect(createMinimalChange('aaa', 'aa')).toEqual({ from: 2, to: 3, insert: '' });
  expect(createMinimalChange('same', 'same')).toBeNull();
});

test('normalizes every kind of line break to LF', () => {
  expect(normalizeLineBreaks('a\r\nb\rc\n')).toBe('a\nb\nc\n');
});
