import { expect, test } from 'bun:test';

import { fuzzyMatch, rankPaths } from './fuzzy-match';

test('matches characters in order, anywhere in the path', () => {
  expect(fuzzyMatch('edsess', 'src/lib/editor/editor-session.ts')).not.toBeNull();
  expect(fuzzyMatch('xyz', 'src/lib/editor/editor-session.ts')).toBeNull();
});

test('ranks file name and word-start matches above scattered ones', () => {
  const paths = ['/repo/docs/research.md', '/repo/src/lib/csv/csv-model.ts', '/repo/src/components/CsvTable/CsvRow.tsx'];
  expect(rankPaths('csvrow', paths, '/repo').map((result) => result.label)).toEqual(['src/components/CsvTable/CsvRow.tsx']);
  expect(rankPaths('cm', paths, '/repo')[0].label).toBe('src/lib/csv/csv-model.ts');
});

test('keeps the given order (recent files first) for an empty query', () => {
  const paths = ['/b.md', '/a.md'];
  expect(rankPaths('', paths, null).map((result) => result.path)).toEqual(paths);
});
