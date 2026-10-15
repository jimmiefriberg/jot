import { useEffect, useState } from 'react';

import { PANE_POSITION, listenForPaneLayout } from '../tauri/backend';
import type { PanePosition } from '../tauri/backend';

/** Where this pane sits in its window; Rust sends it whenever the window splits or joins again. */
export function usePanePosition(): PanePosition {
  const [position, setPosition] = useState<PanePosition>(PANE_POSITION.single);
  useEffect(() => listenForPaneLayout(setPosition), []);
  return position;
}
