import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error";

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  toast: (input: Omit<ToastItem, "id" | "variant"> & { variant?: ToastVariant }) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  toast: ({ variant = "default", ...rest }) =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID(), variant, ...rest }],
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable outside React components. */
export const toast = (input: Omit<ToastItem, "id" | "variant"> & { variant?: ToastVariant }) =>
  useToastStore.getState().toast(input);
