import { useState } from "react";
import type { User } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "../../auth/roles";
import { ResourceConfig, ResourceManager } from "../../components/crud/ResourceManager";
import { Badge } from "../../components/ui/Feedback";
import { Select } from "../../components/ui/Form";
import { PageHeader } from "../../components/ui/Layout";

export default function UsersPage() {
  const me = useUser();
  const [role, setRole] = useState("");
  const canCreate = !!me.school; // platform admins aren't inside a school; see the note below
  const config: ResourceConfig<User> = {
    noun: "user", endpoint: "users", search: true, canCreate, canEdit: true, canDelete: false,
    params: { role: role || undefined },
    intro: canCreate ? "Everyone who can sign in to your school. Deactivate a user instead of deleting them, so history stays intact." : "Platform admins can view users. Create a school's first administrator in the Django admin (private ADMIN_URL), then they add everyone else here.",
    toolbar: <Select className="w-44" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}><option value="">Any role</option>{ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>,
    columns: [
      { key: "n", header: "Name", cell: (u) => <span className="font-medium">{u.first_name} {u.last_name}</span> },
      { key: "e", header: "Email", cell: (u) => u.email },
      { key: "r", header: "Role", cell: (u) => ROLE_LABELS[u.role] ?? u.role },
      { key: "p", header: "Phone", cell: (u) => u.phone || "—" },
      { key: "a", header: "Status", cell: (u) => (u.is_active === false ? <Badge tone="bad">Inactive</Badge> : <Badge tone="good">Active</Badge>) },
    ],
    fields: [
      { name: "first_name", label: "First name", type: "text", required: true }, { name: "last_name", label: "Last name", type: "text", required: true },
      { name: "email", label: "Email (used to sign in)", type: "email", required: true, wide: true },
      { name: "role", label: "Role", type: "select", required: true, options: ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
      { name: "phone", label: "Phone", type: "text" },
      { name: "password", label: "Temporary password", type: "password", required: true, createOnly: true, hint: "At least 10 characters." },
      { name: "password", label: "Reset password", type: "password", editOnly: true, hint: "Leave blank to keep the current password." },
      { name: "is_active", label: "Can sign in", type: "checkbox", editOnly: true, defaultValue: true },
    ],
  };
  return (<><PageHeader title="Users" /><ResourceManager config={config} /></>);
}
