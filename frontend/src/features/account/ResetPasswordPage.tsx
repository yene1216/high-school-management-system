import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { api, errorText } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { ErrorNote } from "../../components/ui/Feedback";
import { Field, Input } from "../../components/ui/Form";

const requestSchema = z.object({ email: z.string().email("Enter a valid email address.") });
const confirmSchema = z.object({ password: z.string().min(10, "Use at least 10 characters."), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

/** One page, two modes: ask for a reset link, or (with ?uid&token from the email) choose a new password. */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const uid = params.get("uid");
  const token = params.get("token");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirming = !!(uid && token);

  const req = useForm<z.infer<typeof requestSchema>>({ resolver: zodResolver(requestSchema) });
  const conf = useForm<z.infer<typeof confirmSchema>>({ resolver: zodResolver(confirmSchema) });

  const onRequest = req.handleSubmit(async (v) => {
    setError(null);
    try { setMessage((await api<{ detail: string }>("/auth/password-reset/", { method: "POST", json: { email: v.email }, anonymous: true })).detail); }
    catch (e) { setError(errorText(e)); }
  });
  const onConfirm = conf.handleSubmit(async (v) => {
    setError(null);
    try { setMessage((await api<{ detail: string }>("/auth/password-reset/confirm/", { method: "POST", json: { uid, token, new_password: v.password }, anonymous: true })).detail); }
    catch (e) { setError(errorText(e)); }
  });

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <h1 className="text-3xl font-semibold">{confirming ? "Choose a new password" : "Reset your password"}</h1>
        <ErrorNote message={error} />
        {message ? (
          <p role="status" className="rounded-md bg-present/10 px-3 py-2 text-sm text-present">{message}</p>
        ) : confirming ? (
          <form onSubmit={onConfirm} noValidate className="space-y-4">
            <Field label="New password" htmlFor="pw" hint="At least 10 characters." error={conf.formState.errors.password?.message}>
              <Input id="pw" type="password" autoComplete="new-password" invalid={!!conf.formState.errors.password} {...conf.register("password")} />
            </Field>
            <Field label="Repeat the password" htmlFor="pw2" error={conf.formState.errors.confirm?.message}>
              <Input id="pw2" type="password" autoComplete="new-password" invalid={!!conf.formState.errors.confirm} {...conf.register("confirm")} />
            </Field>
            <Button type="submit" className="w-full" loading={conf.formState.isSubmitting}>Save password</Button>
          </form>
        ) : (
          <form onSubmit={onRequest} noValidate className="space-y-4">
            <Field label="Email" htmlFor="em" error={req.formState.errors.email?.message} hint="We'll email a link if the address has an account.">
              <Input id="em" type="email" autoComplete="username" invalid={!!req.formState.errors.email} {...req.register("email")} />
            </Field>
            <Button type="submit" className="w-full" loading={req.formState.isSubmitting}>Send reset link</Button>
          </form>
        )}
        <p className="text-sm"><Link className="underline" to="/login">Back to sign in</Link></p>
      </div>
    </main>
  );
}
