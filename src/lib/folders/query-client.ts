import { QueryClient } from '@tanstack/react-query';

/** Shared cache for folder listings. Listings refresh when the window gets focus (see the window integration). */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: false } },
});

export const DIRECTORY_QUERY_KEY = 'directory';
export const FOLDER_FILES_QUERY_KEY = 'folder-files';
export const RECENT_FILES_QUERY_KEY = 'recent-files';

export function refreshFolderListings(): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === DIRECTORY_QUERY_KEY || query.queryKey[0] === FOLDER_FILES_QUERY_KEY,
  });
}
