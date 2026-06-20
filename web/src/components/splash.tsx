import { Logo } from "@/components/brand";

export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Logo className="h-12 w-12 animate-pulse" />
    </div>
  );
}
