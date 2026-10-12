import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formErrors } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import type { Section, Student } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { FAMILY, REGISTRY } from "../../auth/roles";
import { FormModal, FieldDef } from "../../components/crud/ResourceManager";
import { AuthImage } from "../../components/domain/AuthImage";
import { RemoteSelect } from "../../components/domain/Pickers";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, StatusBadge } from "../../components/ui/Feedback";
import { FileField, Input, Select } from "../../components/ui/Form";
import { PageHeader } from "../../components/ui/Layout";
import { Modal } from "../../components/ui/Modal";
import { Column, DataTable, Pagination } from "../../components/ui/Table";
import { useI18n } from "../../i18n";
import { localISODate } from "../../lib/format";
import { useDebounced } from "../../lib/useDebounced";

export const STUDENT_FIELDS: FieldDef[] = [
  { name: "first_name", label: "First name", type: "text", required: true },
  { name: "middle_name", label: "Middle name", type: "text" },
  { name: "last_name", label: "Last name", type: "text", required: true },
  { name: "date_of_birth", label: "Date of birth", type: "date", required: true },
  { name: "gender", label: "Gender", type: "select", required: true, options: [{ value: "F", label: "Female" }, { value: "M", label: "Male" }] },
  { name: "nationality", label: "Nationality", type: "text", defaultValue: "Ethiopian" },
  { name: "admission_date", label: "Admission date", type: "date", defaultValue: localISODate() },
  { name: "address", label: "Address", type: "text", wide: true },
];

function ImportModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; duplicates: { line: number; name: string }[]; errors: { line: number; errors: Record<string, string[]> }[] } | null>(null);
  const run = useAction(() => { const f = new FormData(); f.append("file", file as File); return api<NonNullable<typeof result>>("/students/import/", { method: "POST", form: f }); },
    { silentError: true, onSuccess: (r) => setResult(r) });
  return (
    <Modal open title="Import students from CSV" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{result ? "Close" : "Cancel"}</Button>{!result && <Button disabled={!file} loading={run.isPending} onClick={() => run.mutate(undefined, { onError: (e) => setErr(formErrors(e)._ ?? formErrors(e).file ?? "Import failed.") })}>Import</Button>}</>}>
      {result ? (
        <div className="space-y-3 text-sm">
          <p className="font-medium text-present">{result.created} student{result.created === 1 ? "" : "s"} added.</p>
          {result.duplicates.length > 0 && <div><p className="font-medium">Skipped as duplicates ({result.duplicates.length})</p><ul className="ml-4 list-disc text-muted">{result.duplicates.map((d) => <li key={d.line}>Line {d.line}: {d.name}</li>)}</ul></div>}
          {result.errors.length > 0 && <div><p className="font-medium text-absent">Rows with problems ({result.errors.length})</p><ul className="ml-4 list-disc text-muted">{result.errors.map((e) => <li key={e.line}>Line {e.line}: {Object.entries(e.errors).map(([k, v]) => `${k} — ${v.join(" ")}`).join("; ")}</li>)}</ul></div>}
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p>Upload a CSV with these columns: <code className="rounded bg-black/5 px-1">first_name, last_name, date_of_birth, gender</code> (and optionally <code className="rounded bg-black/5 px-1">middle_name, address</code>). Dates are <code>YYYY-MM-DD</code>; gender is <code>M</code> or <code>F</code>. Students who already exist are skipped.</p>
          <FileField label="CSV file" accept=".csv,text/csv" onChange={setFile} />
          <ErrorNote message={err} />
        </div>
      )}
    </Modal>
  );
}

export default function StudentsPage() {
  const user = useUser();
  const { t } = useI18n();
  const navigate = useNavigate();
  const family = FAMILY.includes(user.role);
  const canAdd = REGISTRY.includes(user.role);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  const [section, setSection] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const search = useDebounced(term, 300);
  const PAGE = 25;
  const list = useList<Student>("students", { search: search || undefined, status: status || undefined, enrollments__section: section || undefined, page, page_size: PAGE });
  const create = useAction((payload: Record<string, unknown>) => api<Student>("/students/", { method: "POST", json: payload }), {
    silentError: true, success: "Student added.", onSuccess: (s) => { setAdding(false); navigate(`/students/${s.id}`); },
  });

  const columns: Column<Student>[] = [
    { key: "name", header: "Name", cell: (s) => (
      <span className="flex items-center gap-3">
        <AuthImage path={s.photo_url} alt={s.full_name} className="h-9 w-9 shrink-0 rounded-full text-sm" />
        <span className="font-medium">{s.full_name}</span>
      </span>) },
    { key: "code", header: "Student ID", cell: (s) => <span className="text-muted">{s.student_code}</span> },
    { key: "section", header: "Class", cell: (s) => s.current_section?.name ?? <span className="text-muted">Not enrolled</span> },
    { key: "guardians", header: "Guardians", cell: (s) => s.guardians.length || <span className="text-muted">None</span> },
    { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
  ];

  return (
    <>
      <PageHeader title={user.role === "student" ? t("nav.myRecord", "My record") : family ? t("nav.myChildren", "My children") : t("nav.students", "Students")}
        subtitle={list.data ? `${list.data.count} ${list.data.count === 1 ? "student" : "students"}` : undefined}
        actions={canAdd ? <><Button variant="secondary" onClick={() => setImporting(true)}>Import CSV</Button><Button onClick={() => { setErrors({}); setAdding(true); }}>Add student</Button></> : undefined} />
      {!family && (
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Search by name or ID…" aria-label="Search students" value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }} />
          <Select className="w-40" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Any status</option><option value="active">Active</option><option value="withdrawn">Withdrawn</option><option value="transferred">Transferred</option><option value="graduated">Graduated</option>
          </Select>
          <div className="w-48"><RemoteSelect endpoint="sections" value={section} onChange={(v) => { setSection(v); setPage(1); }} text={(s: Section) => s.label} placeholder="Any class" /></div>
        </div>
      )}
      <DataTable columns={columns} rows={list.data?.results} rowKey={(s) => s.id} loading={list.isLoading} onRowClick={(s) => navigate(`/students/${s.id}`)}
        empty={<EmptyState title="No students found">{family ? "No children are linked to your account yet. Ask the school office to link them." : canAdd ? "Add the first student, or import a CSV." : "Try a different search."}</EmptyState>} />
      <Pagination page={page} pageSize={PAGE} count={list.data?.count ?? 0} onChange={setPage} />
      {adding && <FormModal open mode="create" title="Add student" fields={STUDENT_FIELDS} initialValues={{ gender: "", nationality: "Ethiopian", admission_date: localISODate() }} errors={errors} saving={create.isPending}
        onClose={() => setAdding(false)} onSubmit={(payload) => create.mutate(payload, { onError: (e) => setErrors(formErrors(e)) })} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </>
  );
}
