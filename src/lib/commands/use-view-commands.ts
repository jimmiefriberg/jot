import { useEffect, useRef } from 'react';

import { registerViewCommandHandler } from './command-bus';

/** Makes the calling view handle these menu actions while it is on screen. */
export function useViewCommands(commands: Record<string, () => void>): void {
  // A ref keeps the latest handlers without re-registering on every render.
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  useEffect(() => {
    function handleViewCommand(actionId: string) {
      const command = commandsRef.current[actionId];
      if (!command) return false;
      command();
      return true;
    }
    return registerViewCommandHandler(handleViewCommand);
  }, []);
}
