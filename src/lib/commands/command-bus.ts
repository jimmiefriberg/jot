/** Handles a menu action for the view that's currently on screen. Returns true when it handled the action. */
export type ViewCommandHandler = (actionId: string) => boolean;

let activeViewHandler: ViewCommandHandler | null = null;

/** Makes a formatted view (CSV table, JSON tree) the receiver of view commands. Returns a function that unregisters it. */
export function registerViewCommandHandler(handler: ViewCommandHandler): () => void {
  activeViewHandler = handler;
  return () => {
    if (activeViewHandler === handler) activeViewHandler = null;
  };
}

export function runViewCommand(actionId: string): boolean {
  return activeViewHandler?.(actionId) ?? false;
}
