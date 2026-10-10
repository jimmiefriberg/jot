import { beforeEach, expect, test } from 'bun:test';

import { openFolder, revealInSidebar, toggleDirectory, useFolderStore } from './folder-store';

beforeEach(() => openFolder('/projects/site'));

test('reveals a file by expanding the folders above it', () => {
  revealInSidebar('/projects/site/docs/guides/setup.md');
  expect([...useFolderStore.getState().expandedDirectories]).toEqual(['/projects/site/docs', '/projects/site/docs/guides']);
});

test('ignores files outside the open folder', () => {
  revealInSidebar('/projects/site-old/readme.md');
  expect(useFolderStore.getState().expandedDirectories.size).toBe(0);
});

test('toggles folders open and closed', () => {
  toggleDirectory('/projects/site/docs');
  expect(useFolderStore.getState().expandedDirectories.has('/projects/site/docs')).toBe(true);
  toggleDirectory('/projects/site/docs');
  expect(useFolderStore.getState().expandedDirectories.has('/projects/site/docs')).toBe(false);
});
