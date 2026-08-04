"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import Toast, { ToastType } from "./Toast";

export type ToastOptions = {
  actionHref?: string;
  actionLabel?: string;
};

interface ToastContextType {
  showToast: (message: string, type: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    actionHref?: string;
    actionLabel?: string;
  } | null>(null);

  const showToast = (
    message: string,
    type: ToastType,
    options?: ToastOptions,
  ) => {
    setToast({
      message,
      type,
      actionHref: options?.actionHref,
      actionLabel: options?.actionLabel,
    });
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          actionHref={toast.actionHref}
          actionLabel={toast.actionLabel}
          onClose={() => setToast(null)}
        />
      )}
    </ToastContext.Provider>
  );
}
