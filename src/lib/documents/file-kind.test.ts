import { expect, test } from 'bun:test';

import { detectFileKind, hasFormattedView } from './file-kind';

test('detects kinds by extension, falling back to plain text', () => {
  expect(detectFileKind('/notes/todo.MD')).toBe('markdown');
  expect(detectFileKind('/app/tsconfig.jsonc')).toBe('json');
  expect(detectFileKind('/ci/deploy.yml')).toBe('yaml');
  expect(detectFileKind('/build/pom.xml')).toBe('xml');
  expect(detectFileKind('/etc/hosts')).toBe('text');
  expect(detectFileKind('/app/.env')).toBe('text');
  expect(detectFileKind('/app/Cargo.toml')).toBe('text');
  expect(detectFileKind(null)).toBe('text');
});

test('every kind except plain text has a formatted view', () => {
  expect(['markdown', 'json', 'csv', 'yaml', 'xml', 'text'].map((kind) => hasFormattedView(detectFileKind(`x.${kind === 'markdown' ? 'md' : kind}`)))).toEqual([
    true, true, true, true, true, false,
  ]);
});
