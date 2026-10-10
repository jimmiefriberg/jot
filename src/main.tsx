import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from './lib/folders/query-client';
import { isSettingsWindow, showWindowIfHidden } from './lib/tauri/backend';
import { EditorWindow } from './app/EditorWindow';
import { SettingsWindow } from './app/SettingsWindow';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/fira-code';
import '@fontsource-variable/source-serif-4';
import './styles/global.css';
import './styles/editor.css';
import './styles/live-preview.css';
import './styles/tree-view.css';
import './styles/csv-table.css';
import './styles/sidebar.css';
import './styles/quick-open.css';
import './styles/settings.css';

/** Windows open hidden and show themselves once ready; if startup stalls, show the window anyway after this long. */
const SHOW_WINDOW_FALLBACK_MS = 2000;

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

window.setTimeout(showWindowIfHidden, SHOW_WINDOW_FALLBACK_MS);

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>{isSettingsWindow() ? <SettingsWindow /> : <EditorWindow />}</QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
