"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/providers/auth-provider";
import { usersApi } from "@/lib/api/users";
import { messagesApi } from "@/lib/api/messages";
import { profileSchema, type ProfileValues } from "@/lib/validations";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/store/toast";

const MAX_UPLOAD_BYTES = 1 * 1024 * 1024;

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, setUser } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      displayName: user?.displayName || user?.username || "",
      statusText: user?.statusText || "",
      bio: user?.bio || "",
    },
  });

  if (!user) return null;

  const onUpload = async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({ variant: "error", title: "Image is too large", description: "Uploads must be 1 MB or smaller." });
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const { attachment } = await messagesApi.upload(file);
      if (attachment.type !== "image") {
        toast({ variant: "error", title: "Choose an image", description: "Profile photos must be image files." });
        return;
      }
      setAvatarUrl(attachment.url);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 501 ? "Image uploads aren't configured on this server." : "Upload failed.";
      toast({ variant: "error", title: "Couldn't upload", description: msg });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onSubmit = async (values: ProfileValues) => {
    setSaving(true);
    try {
      const { user: updated } = await usersApi.updateProfile({ ...values, avatarUrl });
      setUser(updated);
      toast({ variant: "success", title: "Profile updated" });
      onOpenChange(false);
    } catch {
      toast({ variant: "error", title: "Couldn't save profile" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="group relative cursor-pointer rounded-full"
              aria-label="Change avatar"
            >
              <Avatar name={user.displayName || user.username} src={avatarUrl || undefined} size="xl" />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? <Spinner className="text-white" /> : <Camera className="h-5 w-5 text-white" />}
              </span>
            </button>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">@{user.username}</p>
              <p>Tap the photo to upload a new picture.</p>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" {...register("displayName")} />
            {errors.displayName && <p className="text-xs text-danger">{errors.displayName.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statusText">Status</Label>
            <Input id="statusText" placeholder="Working from home ☕" {...register("statusText")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={3} placeholder="A little about you" {...register("bio")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={saving}>
              {saving ? <Spinner className="text-white" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
