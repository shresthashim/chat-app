"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/store/toast";
import { cn } from "@/lib/utils";

const icons: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

const accent: Record<ToastVariant, string> = {
  default: "text-primary",
  success: "text-accent",
  error: "text-danger",
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
      {toasts.map((t) => {
        const Icon = icons[t.variant];
        return (
          <ToastPrimitive.Root
            key={t.id}
            onOpenChange={(open) => !open && dismiss(t.id)}
            className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-pop)] data-[state=open]:animate-pop-in data-[swipe=end]:animate-fade-in"
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", accent[t.variant])} />
            <div className="flex-1">
              {t.title && <ToastPrimitive.Title className="text-sm font-semibold">{t.title}</ToastPrimitive.Title>}
              {t.description && (
                <ToastPrimitive.Description className="text-sm text-muted-foreground">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </ToastPrimitive.Provider>
  );
}
