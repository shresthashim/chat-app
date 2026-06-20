import { cn } from "@/lib/utils";

/** Small count/label pill. The gradient variant marks unread activity. */
export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "gradient" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none font-mono",
        variant === "gradient" && "gradient-brand text-white",
        variant === "default" && "bg-primary text-primary-foreground",
        variant === "muted" && "bg-surface-3 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
