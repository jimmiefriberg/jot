import { useState } from 'react';

/** What is being edited: a node (by path) and which part of it, such as "value", "key" or "attribute-0". */
export interface EditTarget {
  path: string;
  field: string;
}

export function useTreeEditing() {
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  function startEditing(path: string, field: string) {
    setEditTarget({ path, field });
  }

  function stopEditing() {
    setEditTarget(null);
  }

  return { editTarget, startEditing, stopEditing };
}

export function isEditing(editTarget: EditTarget | null, path: string, field: string): boolean {
  return editTarget?.path === path && editTarget.field === field;
}
