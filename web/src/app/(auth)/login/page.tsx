"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/components/providers/auth-provider";
import { loginSchema, type LoginValues } from "@/lib/validations";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true);
    try {
      await login(values);
      router.replace("/chat");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Try again.";
      toast({ variant: "error", title: "Couldn't sign in", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Pick up right where you left off.</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identifier">Username or email</Label>
          <Input id="identifier" autoComplete="username" autoFocus {...register("identifier")} />
          {errors.identifier && <FieldError>{errors.identifier.message}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <FieldError>{errors.password.message}</FieldError>}
        </div>

        <Button type="submit" variant="gradient" size="lg" className="mt-1" disabled={submitting}>
          {submitting ? <Spinner className="text-white" /> : "Log in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to ChatHub?{" "}
        <Link href="/register" className="cursor-pointer font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-danger">{children}</p>;
}
