import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formErrors } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import type { Assessment, Section, Subject, Term } from "../../api/types";
import { FormModal } from "../../components/crud/ResourceManager";
import { RemoteSelect } from "../../components/domain/Pickers";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, StatusBadge } from "../../components/ui/Feedback";
import { Select } from "../../components/ui/Form";
import { PageHeader } from "../../components/ui/Layout";
import { Column, DataTable, Pagination } from "../../components/ui/Table";
import { useI18n } from "../../i18n";
import { fmtDate, label, localISODate, num } from "../../lib/format";

export const KINDS = [{ value: "quiz", label: "Quiz" }, { value: "assignment", label: "Assignment" }, { value: "midterm", label: "Midterm" }, { value: "final", label: "Final exam" }, { value: "other", label: "Other" }];

export default function GradebookPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [published, setPublished] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const q = useList<Assessment>("assessments", { section: section || undefined, subject: subject || undefined, is_published: published || undefined, page, page_size: 25 });
  const create = useAction((p: Record<string, unknown>) => api<Assessment>("/assessments/", { method: "POST", json: p }), {
    silentError: true, success: "Assessment created.", onSuccess: (a) => { setAdding(false); navigate(`/gradebook/${a.id}`); },
  });

  const columns: Column<Assessment>[] = [
    { key: "n", header: "Assessment", cell: (a) => <Link className="font-medium hover:underline" to={`/gradebook/${a.id}`}>{a.name}</Link> },
    { key: "c", header: "Class", cell: (a) => a.section_label },
    { key: "s", header: "Subject", cell: (a) => a.subject_name },
    { key: "k", header: "Type", cell: (a) => label(a.kind) },
    { key: "d", header: "Date", cell: (a) => fmtDate(a.date) },
    { key: "m", header: "Out of", align: "right", cell: (a) => num(a.max_score) },
    { key: "w", header: "Weight", align: "right", cell: (a) => num(a.weight) },
    { key: "p", header: "Status", cell: (a) => <StatusBadge status={a.is_published ? "published" : "draft"} /> },
  ];

  return (
    <>
      <PageHeader title={t("nav.gradebook", "Gradebook")} subtitle="Create an assessment, enter marks, then publish so families can see them."
        actions={<Button onClick={() => { setErrors({}); setAdding(true); }}>New assessment</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-48"><RemoteSelect endpoint="sections" value={section} onChange={(v) => { setSection(v); setPage(1); }} text={(s: Section) => s.label} placeholder="Any class" /></div>
        <div className="w-48"><RemoteSelect endpoint="subjects" value={subject} onChange={(v) => { setSubject(v); setPage(1); }} text={(s: Subject) => s.name} placeholder="Any subject" /></div>
        <Select className="w-40" aria-label="Status" value={published} onChange={(e) => { setPublished(e.target.value); setPage(1); }}><option value="">Any status</option><option value="false">Draft</option><option value="true">Published</option></Select>
      </div>
      {q.isError ? <ErrorNote message="Couldn't load assessments." /> : (
        <>
          <DataTable columns={columns} rows={q.data?.results} rowKey={(a) => a.id} loading={q.isLoading} onRowClick={(a) => navigate(`/gradebook/${a.id}`)}
            empty={<EmptyState title="No assessments yet">Create your first quiz, assignment or exam with “New assessment”.</EmptyState>} />
          <Pagination page={page} pageSize={25} count={q.data?.count ?? 0} onChange={setPage} />
        </>
      )}
      {adding && (
        <FormModal open mode="create" title="New assessment" errors={errors} saving={create.isPending} submitLabel="Create" onClose={() => setAdding(false)}
          fields={[
            { name: "name", label: "Name", type: "text", required: true, wide: true, hint: "e.g. Quiz 1, Midterm exam" },
            { name: "section", label: "Class", type: "select", required: true, remote: { endpoint: "sections", text: (s: Section) => s.label } },
            { name: "subject", label: "Subject", type: "select", required: true, remote: { endpoint: "subjects", text: (s: Subject) => s.name } },
            { name: "kind", label: "Type", type: "select", required: true, options: KINDS },
            { name: "term", label: "Term", type: "select", remote: { endpoint: "terms", text: (t2: Term) => t2.name } },
            { name: "max_score", label: "Maximum score", type: "number", required: true, step: "0.01" },
            { name: "weight", label: "Weight", type: "number", step: "0.01", hint: "Share of the term grade. Weights are relative to each other." },
            { name: "date", label: "Date", type: "date", required: true },
          ]}
          initialValues={{ kind: "quiz", max_score: "20", weight: "10", date: localISODate() }} onSubmit={(p) => create.mutate(p, { onError: (e) => setErrors(formErrors(e)) })} />
      )}
    </>
  );
}
