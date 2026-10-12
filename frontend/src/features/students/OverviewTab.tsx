import { ReactNode, useState } from "react";
import { api, formErrors } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import type { Enrollment, Guardian, Section, Student } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { ADMIN, REGISTRY } from "../../auth/roles";
import { FieldDef, FormModal } from "../../components/crud/ResourceManager";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Feedback";
import { FileField } from "../../components/ui/Form";
import { Card } from "../../components/ui/Layout";
import { Modal } from "../../components/ui/Modal";
import { fmtDate, label } from "../../lib/format";

const REL = [{ value: "father", label: "Father" }, { value: "mother", label: "Mother" }, { value: "guardian", label: "Legal guardian" }, { value: "other", label: "Other" }];

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v || "—"}</dd></div>;
}

export function OverviewTab({ student: s }: { student: Student }) {
  const user = useUser();
  const canRegister = REGISTRY.includes(user.role);
  const isAdmin = ADMIN.includes(user.role);
  const [dlg, setDlg] = useState<"" | "section" | "link" | "guardian" | "login" | "photo">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const close = () => { setDlg(""); setErrors({}); };
  const onErr = (e: unknown) => setErrors(formErrors(e));

  const enrollments = useList<Enrollment>("enrollments", { student: s.id, status: "active" }, canRegister);
  const active = enrollments.data?.results[0];

  const changeSection = useAction(async (sectionId: number) => {
    if (active) await api(`/enrollments/${active.id}/`, { method: "PATCH", json: { status: "completed" } });
    return api("/enrollments/", { method: "POST", json: { student: s.id, section: sectionId } });
  }, { silentError: true, success: "Class updated.", onSuccess: close });

  const linkGuardian = useAction((v: { guardian: number; relationship: string; is_primary: boolean; can_pickup: boolean }) => api(`/students/${s.id}/guardians/`, { method: "POST", json: v }), { silentError: true, success: "Guardian linked.", onSuccess: close });
  const newGuardian = useAction(async (v: Record<string, unknown>) => {
    const { relationship, is_primary, can_pickup, ...person } = v;
    const g = await api<Guardian>("/guardians/", { method: "POST", json: person });
    return api(`/students/${s.id}/guardians/`, { method: "POST", json: { guardian: g.id, relationship, is_primary, can_pickup } });
  }, { silentError: true, success: "Guardian added and linked.", onSuccess: close });
  const makeLogin = useAction(async (v: Record<string, unknown>) => {
    const u = await api<{ id: number }>("/users/", { method: "POST", json: { ...v, role: "student", first_name: s.first_name, last_name: s.last_name } });
    return api(`/students/${s.id}/`, { method: "PATCH", json: { user: u.id } });
  }, { silentError: true, success: "Student login created.", onSuccess: close });
  const upload = useAction(() => { const f = new FormData(); f.append("photo", photo as File); return api(`/students/${s.id}/`, { method: "PATCH", form: f }); }, { silentError: true, success: "Photo updated.", onSuccess: close });

  const linkFields: FieldDef[] = [
    { name: "guardian", label: "Guardian", type: "select", required: true, wide: true, remote: { endpoint: "guardians", text: (g: Guardian) => `${g.first_name} ${g.last_name}${g.phone ? ` · ${g.phone}` : ""}` } },
    { name: "relationship", label: "Relationship", type: "select", required: true, options: REL, defaultValue: "guardian" },
    { name: "is_primary", label: "Primary contact", type: "checkbox" },
    { name: "can_pickup", label: "May pick the student up", type: "checkbox" },
  ];
  const newFields: FieldDef[] = [
    { name: "first_name", label: "First name", type: "text", required: true },
    { name: "last_name", label: "Last name", type: "text", required: true },
    { name: "phone", label: "Phone", type: "text", hint: "Used for SMS alerts." },
    { name: "email", label: "Email", type: "email" },
    { name: "relationship", label: "Relationship", type: "select", required: true, options: REL, defaultValue: "guardian" },
    { name: "is_primary", label: "Primary contact", type: "checkbox" },
    { name: "can_pickup", label: "May pick the student up", type: "checkbox" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Details" actions={canRegister ? <Button variant="secondary" small onClick={() => setDlg("photo")}>Photo</Button> : undefined}>
        <dl>
          <Row k="Date of birth" v={fmtDate(s.date_of_birth)} />
          <Row k="Gender" v={s.gender === "F" ? "Female" : "Male"} />
          <Row k="Nationality" v={s.nationality} />
          <Row k="Address" v={s.address} />
          <Row k="Admitted" v={fmtDate(s.admission_date)} />
          <Row k="Login account" v={s.user ? <Badge tone="good">Linked</Badge> : <span className="text-muted">None</span>} />
        </dl>
        {isAdmin && !s.user && <Button className="mt-3" variant="secondary" small onClick={() => { setErrors({}); setDlg("login"); }}>Create student login</Button>}
      </Card>

      <Card title="Class" actions={canRegister ? <Button variant="secondary" small onClick={() => { setErrors({}); setDlg("section"); }}>{s.current_section ? "Change class" : "Enroll"}</Button> : undefined}>
        {s.current_section ? <p className="text-lg font-medium">{s.current_section.name}</p> : <p className="text-sm text-muted">Not enrolled in any class this year.</p>}
      </Card>

      <Card className="lg:col-span-2" title="Guardians" actions={canRegister ? <span className="flex gap-2"><Button variant="secondary" small onClick={() => { setErrors({}); setDlg("link"); }}>Link existing</Button><Button small onClick={() => { setErrors({}); setDlg("guardian"); }}>New guardian</Button></span> : undefined}>
        {s.guardians.length === 0 ? <p className="text-sm text-muted">No guardians linked. Alerts can't reach a family until one is.</p> : (
          <ul className="divide-y divide-line">
            {s.guardians.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><span className="font-medium">{g.guardian_name}</span> <span className="text-muted">· {label(g.relationship)} · {g.guardian_phone || "no phone"}</span></span>
                <span className="flex gap-1">{g.is_primary && <Badge tone="info">Primary</Badge>}{g.can_pickup && <Badge tone="good">Pickup</Badge>}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {dlg === "section" && (
        <FormModal open mode="create" title={s.current_section ? "Change class" : "Enroll in a class"} errors={errors} saving={changeSection.isPending} submitLabel="Save" onClose={close}
          fields={[{ name: "section", label: "Class", type: "select", required: true, wide: true, remote: { endpoint: "sections", text: (x: Section) => `${x.label} (${x.student_count}/${x.capacity})` } }]}
          initialValues={{ section: "" }} onSubmit={(p) => changeSection.mutate(Number(p.section), { onError: onErr })} />
      )}
      {dlg === "link" && <FormModal open mode="create" title="Link an existing guardian" fields={linkFields} initialValues={{ relationship: "guardian" }} errors={errors} saving={linkGuardian.isPending} onClose={close}
        onSubmit={(p) => linkGuardian.mutate(p as never, { onError: onErr })} />}
      {dlg === "guardian" && <FormModal open mode="create" title="New guardian" fields={newFields} initialValues={{ relationship: "guardian", is_primary: s.guardians.length === 0 }} errors={errors} saving={newGuardian.isPending} onClose={close}
        onSubmit={(p) => newGuardian.mutate(p, { onError: onErr })} />}
      {dlg === "login" && <FormModal open mode="create" title="Create student login" errors={errors} saving={makeLogin.isPending} onClose={close}
        fields={[{ name: "email", label: "Email (used to sign in)", type: "email", required: true, wide: true }, { name: "password", label: "Temporary password", type: "password", required: true, hint: "At least 10 characters. They can change it in Settings.", wide: true }]}
        initialValues={{}} onSubmit={(p) => makeLogin.mutate(p, { onError: onErr })} />}
      {dlg === "photo" && (
        <Modal open title="Student photo" onClose={close} footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button disabled={!photo} loading={upload.isPending} onClick={() => upload.mutate(undefined, { onError: onErr })}>Upload</Button></>}>
          <FileField label="Choose an image" accept="image/*" onChange={setPhoto} error={errors.photo ?? errors._} hint="JPG or PNG, up to 10 MB." />
        </Modal>
      )}
    </div>
  );
}
