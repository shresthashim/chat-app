"use client";

import { forwardRef } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, getInitials } from "@/lib/utils";

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
  "2xl": "h-28 w-28 text-3xl",
} as const;

interface AvatarProps {
  name: string;
  src?: string;
  size?: keyof typeof sizeMap;
  online?: boolean;
  className?: string;
}

/** Avatar with deterministic initials fallback and an optional breathing presence dot. */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ name, src, size = "md", online, className }, ref) => (
    <span ref={ref} className={cn("relative inline-flex shrink-0", className)}>
      <AvatarPrimitive.Root
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-full bg-surface-3 font-semibold text-foreground/80 ring-1 ring-border",
          sizeMap[size],
        )}
      >
        {src ? <AvatarPrimitive.Image src={src} alt={name} className="h-full w-full object-cover" /> : null}
        <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center gradient-brand text-white">
          {getInitials(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-surface",
            size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3",
            online ? "bg-accent animate-breathe" : "bg-muted-foreground/50",
          )}
          aria-hidden
        />
      )}
    </span>
  ),
);
Avatar.displayName = "Avatar";
