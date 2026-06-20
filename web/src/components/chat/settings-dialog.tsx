"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, LogOut, Palette, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/providers/auth-provider";
import { authApi } from "@/lib/api/auth";
import { ensureNotificationPermission } from "@/lib/notifications";
import { disconnectSocket } from "@/lib/socket";
import { toast } from "@/store/toast";

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [notificationsOn, setNotificationsOn] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsOn(Notification.permission === "granted");
    }
  }, [open]);

  const toggleNotifications = async (next: boolean) => {
    if (!next) {
      toast({ title: "Manage permissions", description: "Turn notifications off from your browser's site settings." });
      return;
    }
    const granted = await ensureNotificationPermission();
    setNotificationsOn(granted);
    if (!granted) toast({ variant: "error", title: "Notifications blocked", description: "Allow them in your browser settings." });
  };

  const logoutEverywhere = async () => {
    try {
      await authApi.logoutAll();
      disconnectSocket();
      await logout();
      router.replace("/login");
    } catch {
      toast({ variant: "error", title: "Couldn't sign out everywhere" });
    }
  };

  const handleLogout = async () => {
    disconnectSocket();
    await logout();
    router.replace("/login");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          <Row icon={Palette} title="Appearance" description="Choose how ChatHub looks.">
            <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    theme === t ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>

          <Separator />

          <Row icon={Bell} title="Desktop notifications" description="Get pinged when a new message arrives.">
            <Switch checked={notificationsOn} onCheckedChange={toggleNotifications} />
          </Row>

          <Separator />

          <Row icon={ShieldCheck} title="Sign out everywhere" description="Ends every active session on all devices.">
            <Button variant="outline" size="sm" onClick={logoutEverywhere}>
              Sign out all
            </Button>
          </Row>
        </div>

        <Button variant="danger" className="mt-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0 pl-12 sm:pl-0">{children}</div>
    </div>
  );
}
