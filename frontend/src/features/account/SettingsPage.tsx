import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, formErrors } from "../../api/client";
import { useAction, useItem } from "../../api/hooks";
import type { Preference, User } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { ROLE_LABELS } from "../../auth/roles";
import { Button } from "../../components/ui/Button";
import { ErrorNote, Spinner } from "../../components/ui/Feedback";
import { Field, Input, Select } from "../../components/ui/Form";
import { Card, PageHeader, Tabs, useTabParam } from "../../components/ui/Layout";
import { label } from "../../lib/format";

const profileSchema = z.object({ first_name: z.string().min(1, "Required"), last_name: z.string().min(1, "Required"), phone: z.string().optional(), language: z.enum(["en", "am"]) });
const passwordSchema = z.object({ old_password: z.string().min(1, "Required"), new_password: z.string().min(10, "Use at least 10 characters."), confirm: z.string() })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

function Profile() {
  const { user, reloadUser } = useAuth();
  const [serverErr, setServerErr] = useState<Record<string, string>>({});
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: user?.first_name, last_name: user?.last_name, phone: user?.phone ?? "", language: user?.language ?? "en" },
  });
  const save = useAction((v: z.infer<typeof profileSchema>) => api<User>("/auth/me/", { method: "PATCH", json: v }), {
    success: "Profile saved.", silentError: true, onSuccess: () => { setServerErr({}); void reloadUser(); },
  });
  return (
    <Card title="Your details">
      <form className="grid max-w-xl gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit((v) => save.mutate(v, { onError: (e) => setServerErr(formErrors(e)) }))}>
        <Field label="First name" htmlFor="fn" error={errors.first_name?.message ?? serverErr.first_name}><Input id="fn" {...register("first_name")} /></Field>
        <Field label="Last name" htmlFor="ln" error={errors.last_name?.message ?? serverErr.last_name}><Input id="ln" {...register("last_name")} /></Field>
        <Field label="Phone" htmlFor="ph" hint="Used for SMS alerts if you turn them on." error={serverErr.phone}><Input id="ph" inputMode="tel" {...register("phone")} /></Field>
        <Field label="Language" htmlFor="lg"><Select id="lg" {...register("language")}><option value="en">English</option><option value="am">አማርኛ</option></Select></Field>
        <div className="sm:col-span-2 text-sm text-muted">{user?.email} · {user ? ROLE_LABELS[user.role] : ""}</div>
        <div className="sm:col-span-2"><ErrorNote message={serverErr._} /><Button type="submit" loading={save.isPending}>Save</Button></div>
      </form>
    </Card>
  );
}

function Password() {
  const [serverErr, setServerErr] = useState<Record<string, string>>({});
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });
  const change = useAction((v: z.infer<typeof passwordSchema>) => api("/auth/change-password/", { method: "POST", json: { old_password: v.old_password, new_password: v.new_password } }), {
    success: "Password changed.", silentError: true, onSuccess: () => { setServerErr({}); reset(); },
  });
  return (
    <Card title="Change password">
      <form className="max-w-sm space-y-4" noValidate onSubmit={handleSubmit((v) => change.mutate(v, { onError: (e) => setServerErr(formErrors(e)) }))}>
        <Field label="Current password" htmlFor="op" error={errors.old_password?.message ?? serverErr.old_password}><Input id="op" type="password" autoComplete="current-password" {...register("old_password")} /></Field>
        <Field label="New password" htmlFor="np" hint="At least 10 characters; avoid common passwords." error={errors.new_password?.message ?? serverErr.new_password}><Input id="np" type="password" autoComplete="new-password" {...register("new_password")} /></Field>
        <Field label="Repeat new password" htmlFor="cp" error={errors.confirm?.message}><Input id="cp" type="password" autoComplete="new-password" {...register("confirm")} /></Field>
        <ErrorNote message={serverErr._} />
        <Button type="submit" loading={change.isPending}>Change password</Button>
      </form>
    </Card>
  );
}

function Notifications() {
  const q = useItem<Preference[]>("/notification-preferences/");
  const [rows, setRows] = useState<Preference[]>([]);
  useEffect(() => { if (q.data) setRows(q.data); }, [q.data]);
  const save = useAction((v: Preference[]) => api<Preference[]>("/notification-preferences/", { method: "PUT", json: v }), { success: "Preferences saved." });
  if (q.isLoading) return <Spinner />;
  const toggle = (cat: string, key: "in_app" | "email" | "sms") => setRows((rs) => rs.map((r) => (r.category === cat ? { ...r, [key]: !r[key] } : r)));
  return (
    <Card title="How should we reach you?" flush>
      <table className="w-full">
        <thead className="border-b border-line"><tr><th className="th">Type</th><th className="th">In the app</th><th className="th">Email</th><th className="th">SMS</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category} className="border-b border-line last:border-0">
              <td className="td font-medium">{label(r.category)}</td>
              {(["in_app", "email", "sms"] as const).map((k) => (
                <td key={k} className="td"><input type="checkbox" className="h-4 w-4" aria-label={`${label(r.category)} ${k}`} checked={r[k]} onChange={() => toggle(r.category, k)} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-3 border-t border-line p-4">
        <p className="text-xs text-muted">Urgent alerts always appear in the app. SMS needs a phone number in your details.</p>
        <Button onClick={() => save.mutate(rows)} loading={save.isPending}>Save preferences</Button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useTabParam("profile");
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs active={tab} onChange={setTab} tabs={[{ id: "profile", label: "Profile" }, { id: "password", label: "Password" }, { id: "notifications", label: "Notifications" }]} />
      {tab === "profile" && <Profile />}
      {tab === "password" && <Password />}
      {tab === "notifications" && <Notifications />}
    </>
  );
}
