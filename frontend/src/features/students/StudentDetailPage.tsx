import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { api, formErrors } from "../../api/client";
import { useAction, useItem } from "../../api/hooks";
import type { Student } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { FAMILY, FINANCE, REGISTRY } from "../../auth/roles";
import { FormModal } from "../../components/crud/ResourceManager";
import { AuthImage } from "../../components/domain/AuthImage";
import { Button } from "../../components/ui/Button";
import { ErrorNote, Spinner, StatusBadge } from "../../components/ui/Feedback";
import { PageHeader, Tabs, useTabParam } from "../../components/ui/Layout";
import { ApiError } from "../../api/client";
import { AttendanceTab } from "./AttendanceTab";
import { DocumentsTab } from "./DocumentsTab";
import { FeesTab } from "./FeesTab";
import { OverviewTab } from "./OverviewTab";
import { ResultsTab } from "./ResultsTab";
import { STUDENT_FIELDS } from "./StudentsPage";
import { SupportTab } from "./SupportTab";

export default function StudentDetailPage() {
  const { id } = useParams();
  const user = useUser();
  const q = useItem<Student>(`/students/${id}/`);
  const [tab, setTab] = useTabParam("overview");
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction((payload: Record<string, unknown>) => api(`/students/${id}/`, { method: "PATCH", json: payload }), {
    silentError: true, success: "Student updated.", onSuccess: () => setEditing(false),
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return <ErrorNote message={notFound ? "This student wasn't found, or you don't have access to them." : "Couldn't load this student."} />;
  }
  const s = q.data;
  const role = user.role;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "attendance", label: "Attendance" },
    { id: "results", label: "Results" },
    ...([...FINANCE, ...FAMILY].includes(role) ? [{ id: "fees", label: "Fees" }] : []),
    ...([...REGISTRY, "principal", "parent"].includes(role) ? [{ id: "documents", label: "Documents" }] : []),
    ...(["school_admin", "counselor"].includes(role) ? [{ id: "support", label: "Support notes" }] : []),
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : "overview";

  return (
    <>
      <p className="no-print mb-3 text-sm"><Link to="/students" className="text-muted underline">← {FAMILY.includes(role) ? "My children" : "Students"}</Link></p>
      <PageHeader
        title={s.full_name}
        subtitle={<span className="flex flex-wrap items-center gap-2">{s.student_code} · {s.current_section?.name ?? "Not enrolled"} <StatusBadge status={s.status} /></span>}
        actions={REGISTRY.includes(role) ? <Button variant="secondary" onClick={() => { setErrors({}); setEditing(true); }}>Edit details</Button> : undefined} />
      <div className="mb-6 flex items-center gap-4">
        <AuthImage path={s.photo_url} alt={s.full_name} className="h-20 w-20 rounded-full text-2xl" />
      </div>
      <Tabs tabs={tabs} active={active} onChange={setTab} />
      {active === "overview" && <OverviewTab student={s} />}
      {active === "attendance" && <AttendanceTab student={s} />}
      {active === "results" && <ResultsTab student={s} />}
      {active === "fees" && <FeesTab student={s} />}
      {active === "documents" && <DocumentsTab student={s} />}
      {active === "support" && <SupportTab student={s} />}
      {editing && (
        <FormModal open mode="edit" title="Edit student" errors={errors} saving={save.isPending} onClose={() => setEditing(false)}
          fields={[...STUDENT_FIELDS, { name: "status", label: "Status", type: "select", required: true, options: [
            { value: "active", label: "Active" }, { value: "withdrawn", label: "Withdrawn" }, { value: "transferred", label: "Transferred" }, { value: "graduated", label: "Graduated" }] }]}
          initialValues={{ first_name: s.first_name, middle_name: s.middle_name, last_name: s.last_name, date_of_birth: s.date_of_birth, gender: s.gender, nationality: s.nationality, admission_date: s.admission_date, address: s.address, status: s.status }}
          onSubmit={(payload) => save.mutate(payload, { onError: (e) => setErrors(formErrors(e)) })} />
      )}
    </>
  );
}
