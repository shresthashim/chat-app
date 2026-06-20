"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Settings, UserRound, Moon, Sun, Monitor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { disconnectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

interface Props {
  onOpenProfile: () => void;
  onOpenSettings: () => void;
}

export function UserMenu({ onOpenProfile, onOpenSettings }: Props) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  if (!user) return null;

  const handleLogout = async () => {
    disconnectSocket();
    await logout();
    router.replace("/login");
  };

  const themes = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "Auto" },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar name={user.displayName || user.username} src={user.avatarUrl || undefined} size="md" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar name={user.displayName || user.username} src={user.avatarUrl || undefined} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.displayName || user.username}</p>
            <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenProfile}>
          <UserRound className="h-4 w-4" /> Edit profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenSettings}>
          <Settings className="h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <div className="flex gap-1 px-1.5 pb-1.5">
          {themes.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg border py-2 text-[11px] transition-colors",
                theme === value ? "border-primary bg-surface-2 text-foreground" : "border-transparent text-muted-foreground hover:bg-surface-2",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={handleLogout}>
          <LogOut className="h-4 w-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
