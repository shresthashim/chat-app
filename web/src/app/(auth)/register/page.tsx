"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDebounce } from "use-debounce";
import { Check, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { authApi } from "@/lib/api/auth";
import { registerSchema, type RegisterValues } from "@/lib/validations";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type UsernameStatus = "idle" | "checking" | "available" | "taken";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  // Live username availability — debounced so we don't hit the API on every keystroke.
  const username = watch("username");
  const [debouncedUsername] = useDebounce(username?.trim() ?? "", 450);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

  useEffect(() => {
    if (!USERNAME_RE.test(debouncedUsername)) {
      setUsernameStatus("idle");
      return;
    }
    let active = true;
    setUsernameStatus("checking");
    authApi
      .checkUsername(debouncedUsername)
      .then((res) => active && setUsernameStatus(res.available ? "available" : "taken"))
      .catch(() => active && setUsernameStatus("idle"));
    return () => {
      active = false;
    };
  }, [debouncedUsername]);

  const onSubmit = async (values: RegisterValues) => {
    setSubmitting(true);
    try {
      await registerUser({
        username: values.username,
        email: values.email,
        password: values.password,
        displayName: values.displayName || values.username,
      });
      router.replace("/chat");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Try again.";
      toast({ variant: "error", title: "Couldn't create account", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-muted-foreground">It takes less than a minute.</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" placeholder="Maya Chen" autoFocus {...register("displayName")} />
          {errors.displayName && <FieldError>{errors.displayName.message}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <Input id="username" placeholder="mayac" autoComplete="username" className="pr-9" {...register("username")} />
            {!errors.username && usernameStatus !== "idle" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && <Spinner className="text-muted-foreground" />}
                {usernameStatus === "available" && <Check className="h-4 w-4 text-accent" />}
                {usernameStatus === "taken" && <X className="h-4 w-4 text-danger" />}
              </span>
            )}
          </div>
          {errors.username ? (
            <FieldError>{errors.username.message}</FieldError>
          ) : usernameStatus === "available" ? (
            <p className="text-xs text-accent">@{debouncedUsername} is available</p>
          ) : usernameStatus === "taken" ? (
            <FieldError>That username is already taken</FieldError>
          ) : usernameStatus === "checking" ? (
            <p className="text-xs text-muted-foreground">Checking availability…</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="maya@example.com" autoComplete="email" {...register("email")} />
          {errors.email && <FieldError>{errors.email.message}</FieldError>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
            {errors.password && <FieldError>{errors.password.message}</FieldError>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
            {errors.confirmPassword && <FieldError>{errors.confirmPassword.message}</FieldError>}
          </div>
        </div>

        <Button
          type="submit"
          variant="gradient"
          size="lg"
          className="mt-1"
          disabled={submitting || usernameStatus === "taken"}
        >
          {submitting ? <Spinner className="text-white" /> : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="cursor-pointer font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-danger">{children}</p>;
}
