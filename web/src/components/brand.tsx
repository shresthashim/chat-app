import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/config";

/** The ChatHub mark — overlapping speech bubbles in the signature gradient. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-white shadow-sm", className)}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M4 6.5C4 5.12 5.12 4 6.5 4h8C15.88 4 17 5.12 17 6.5v4c0 1.38-1.12 2.5-2.5 2.5H9l-3.2 2.6c-.5.4-1.3.05-1.3-.6V6.5Z"
          fill="currentColor"
        />
        <path
          d="M9 13.5c0 1.38 1.12 2.5 2.5 2.5h3l2.7 2.2c.5.4 1.3.05 1.3-.6V15.4c.9-.45 1.5-1.36 1.5-2.4v-2c0-1.04-.6-1.95-1.5-2.4"
          fill="currentColor"
          opacity="0.55"
        />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Logo />
      <span className="font-display text-xl font-bold tracking-tight">{APP_NAME}</span>
    </span>
  );
}
