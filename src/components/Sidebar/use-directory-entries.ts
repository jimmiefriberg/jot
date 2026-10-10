import { useQuery } from '@tanstack/react-query';

import { DIRECTORY_QUERY_KEY } from '../../lib/folders/query-client';
import { useSettingsStore } from '../../lib/settings/settings-store';
import { readDirectory } from '../../lib/tauri/backend';

/** The entries of one folder, cached and refreshed whenever the window gets focus. */
export function useDirectoryEntries(directoryPath: string) {
  const showHiddenFiles = useSettingsStore((state) => state.settings.showHiddenFiles);
  return useQuery({
    queryKey: [DIRECTORY_QUERY_KEY, directoryPath, showHiddenFiles],
    queryFn: () => readDirectory(directoryPath, showHiddenFiles),
  });
}
