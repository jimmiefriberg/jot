import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { showWindowIfHidden } from '../../lib/tauri/backend';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Shows what went wrong instead of a blank window when rendering fails, and makes sure the window is visible.
 * (React only supports error boundaries as class components.)
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(error, errorInfo.componentStack);
    void showWindowIfHidden();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="error-screen" role="alert">
        <h1>Something went wrong</h1>
        <p>This window ran into a problem and can't show its document. Your file on disk hasn't been changed.</p>
        <pre>{error.message}</pre>
      </div>
    );
  }
}
