import { create } from 'zustand';

interface QuickOpenState {
  isOpen: boolean;
}

export const useQuickOpenStore = create<QuickOpenState>(() => ({ isOpen: false }));

export function openQuickOpen(): void {
  useQuickOpenStore.setState({ isOpen: true });
}

export function closeQuickOpen(): void {
  useQuickOpenStore.setState({ isOpen: false });
}
