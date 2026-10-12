import { useState } from "react";
import { api, formErrors } from "../../api/client";
import { useAction } from "../../api/hooks";
import type { Guardian } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { ADMIN, REGISTRY } from "../../auth/roles";
import { FormModal, ResourceConfig, ResourceManager } from "../../components/crud/ResourceManager";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Feedback";
import { PageHeader } from "../../components/ui/Layout";

function CreateLogin({ g }: { g: Guardian }) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const make = useAction(async (v: Record<string, unknown>) => {
    const u = await api<{ id: number }>("/users/", { method: "POST", json: { ...v, role: "parent", first_name: g.first_name, last_name: g.last_name, phone: g.phone } });
    return api(`/guardians/${g.id}/`, { method: "PATCH", json: { user: u.id } });
  }, { silentError: true, success: "Parent login created.", onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="secondary" small onClick={() => { setErrors({}); setOpen(true); }}>Create login</Button>
      {open && <FormModal open mode="create" title={`Login for ${g.first_name} ${g.last_name}`} errors={errors} saving={make.isPending} onClose={() => setOpen(false)}
        fields={[{ name: "email", label: "Email (used to sign in)", type: "email", required: true, wide: true, defaultValue: g.email }, { name: "password", label: "Temporary password", type: "password", required: true, wide: true, hint: "At least 10 characters. They can change it in Settings." }]}
        initialValues={{ email: g.email }} onSubmit={(p) => make.mutate(p, { onError: (e) => setErrors(formErrors(e)) })} />}
    </>
  );
}

export default function GuardiansPage() {
  const user = useUser();
  const isAdmin = ADMIN.includes(user.role);
  const canWrite = REGISTRY.includes(user.role);
  const config: ResourceConfig<Guardian> = {
    noun: "guardian", endpoint: "guardians", search: true, canCreate: canWrite, canEdit: canWrite, canDelete: canWrite,
    intro: "Parents and guardians. Link them to their children from each student's page. A guardian needs a login to use the family portal.",
    columns: [
      { key: "name", header: "Name", cell: (g) => <span className="font-medium">{g.first_name} {g.last_name}</span> },
      { key: "phone", header: "Phone", cell: (g) => g.phone || "—" },
      { key: "email", header: "Email", cell: (g) => g.email || "—" },
      { key: "login", header: "Portal login", cell: (g) => (g.user ? <Badge tone="good">Has login</Badge> : <Badge>None</Badge>) },
    ],
    fields: [
      { name: "first_name", label: "First name", type: "text", required: true }, { name: "last_name", label: "Last name", type: "text", required: true },
      { name: "phone", label: "Phone", type: "text", hint: "Used for SMS alerts." }, { name: "email", label: "Email", type: "email" },
      { name: "occupation", label: "Occupation", type: "text" }, { name: "address", label: "Address", type: "text" },
    ],
    rowActions: (g) => (isAdmin && !g.user ? <CreateLogin g={g} /> : null),
  };
  return (<><PageHeader title="Guardians" /><ResourceManager config={config} /></>);
}
