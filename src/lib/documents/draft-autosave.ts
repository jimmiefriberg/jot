import { getDocumentLength, getDocumentText } from '../editor/editor-session';
import { deleteDraft, writeDraft } from '../tauri/backend';
import { useDocumentStore } from './document-store';

/** Unsaved text is written to a draft this long after typing pauses, so a crash loses at most a moment of work. */
const DRAFT_DELAY_MS = 1500;
/** Very large documents are left out; writing them every few seconds would slow typing down. */
const MAXIMUM_DRAFT_LENGTH = 10_000_000;

let pendingDraftTimer: ReturnType<typeof setTimeout> | null = null;
let hasDraftOnDisk = false;

function saveDraftNow() {
  pendingDraftTimer = null;
  const { isDirty, path, draftId } = useDocumentStore.getState();
  if (!isDirty || getDocumentLength() > MAXIMUM_DRAFT_LENGTH) {
    if (hasDraftOnDisk) void deleteDraft(draftId);
    hasDraftOnDisk = false;
    return;
  }
  hasDraftOnDisk = true;
  void writeDraft({ id: draftId, path, text: getDocumentText() });
}

function scheduleDraftSave() {
  if (pendingDraftTimer !== null) clearTimeout(pendingDraftTimer);
  pendingDraftTimer = setTimeout(saveDraftNow, DRAFT_DELAY_MS);
}

/** Records that this window started from a recovered draft, which stays on disk until saved or discarded. */
export function adoptRecoveredDraft(draftId: string): void {
  useDocumentStore.setState({ draftId });
  hasDraftOnDisk = true;
}

/** Removes this window's draft (after a save, or when its changes are discarded on close). */
export async function discardDraft(): Promise<void> {
  if (pendingDraftTimer !== null) clearTimeout(pendingDraftTimer);
  pendingDraftTimer = null;
  if (!hasDraftOnDisk) return;
  hasDraftOnDisk = false;
  await deleteDraft(useDocumentStore.getState().draftId);
}

/** Keeps a draft of unsaved changes on disk while this window is open. Returns a function that stops it. */
export function startDraftAutosave(): () => void {
  return useDocumentStore.subscribe((state, previousState) => {
    if (state.revision !== previousState.revision || state.isDirty !== previousState.isDirty) scheduleDraftSave();
  });
}
