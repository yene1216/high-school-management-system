import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, formErrors } from "../../api/client";
import { useAction, useItem } from "../../api/hooks";
import type { Assessment, GradeRow, RosterStudent, Subject, Term } from "../../api/types";
import { FormModal } from "../../components/crud/ResourceManager";
import { Button } from "../../components/ui/Button";
import { ErrorNote, Spinner, StatusBadge, useConfirm } from "../../components/ui/Feedback";
import { Input } from "../../components/ui/Form";
import { Card, PageHeader, Stat } from "../../components/ui/Layout";
import { fmtDate, label, num } from "../../lib/format";
import { KINDS } from "./GradebookPage";

interface Entry { score: string; remarks: string }

export default function AssessmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const a = useItem<Assessment>(`/assessments/${id}/`);
  const roster = useItem<RosterStudent[]>(a.data ? `/sections/${a.data.section}/roster/` : null);
  const grades = useItem<GradeRow[]>(`/assessments/${id}/grades/`);
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!grades.data) return;
    const next: Record<number, Entry> = {};
    for (const g of grades.data) next[g.student] = { score: g.score === null ? "" : String(num(g.score)), remarks: g.remarks };
    setEntries(next);
    setDirty(new Set());
  }, [grades.data]);

  const max = num(a.data?.max_score);
  const save = useAction(() => {
    const records = [...dirty].map((sid) => ({ student: sid, score: entries[sid]?.score === "" || entries[sid] === undefined ? null : Number(entries[sid].score), remarks: entries[sid]?.remarks ?? "" }));
    return api(`/assessments/${id}/grades/`, { method: "PUT", json: { records } });
  }, { silentError: true, success: "Marks saved." });
  const publish = useAction(() => api(`/assessments/${id}/publish/`, { method: "POST" }), { success: "Published. Families have been notified." });
  const update = useAction((p: Record<string, unknown>) => api(`/assessments/${id}/`, { method: "PATCH", json: p }), { silentError: true, success: "Assessment updated.", onSuccess: () => setEditing(false) });
  const remove = useAction(() => api(`/assessments/${id}/`, { method: "DELETE" }), { success: "Assessment deleted.", onSuccess: () => navigate("/gradebook") });

  const students = roster.data ?? [];
  const values = useMemo(() => students.map((s) => entries[s.id]?.score).filter((v): v is string => v !== undefined && v !== "").map(Number), [students, entries]);
  if (a.isLoading || roster.isLoading || grades.isLoading) return <Spinner />;
  if (a.isError || !a.data) return <ErrorNote message={a.error instanceof ApiError && a.error.status === 404 ? "This assessment wasn't found, or it isn't one of your classes." : "Couldn't load this assessment."} />;
  const as = a.data;

  const setField = (sid: number, patch: Partial<Entry>) => {
    setEntries((e) => ({ ...e, [sid]: { score: e[sid]?.score ?? "", remarks: e[sid]?.remarks ?? "", ...patch } }));
    setDirty((d) => new Set(d).add(sid));
    setRowErrors((r) => { const n = { ...r }; delete n[sid]; return n; });
  };
  const onSave = () => {
    const bad: Record<number, string> = {};
    for (const sid of dirty) { const v = entries[sid]?.score; if (v !== undefined && v !== "" && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > max)) bad[sid] = `0 to ${max}`; }
    setRowErrors(bad);
    if (Object.keys(bad).length) { setError("Fix the highlighted marks first."); return; }
    setError(null);
    save.mutate(undefined, { onError: (e) => setError(formErrors(e)._ ?? Object.values(formErrors(e))[0] ?? "Couldn't save.") });
  };
  const onPublish = async () => {
    if (dirty.size) { setError("Save your changes before publishing."); return; }
    const missing = students.filter((s) => (entries[s.id]?.score ?? "") === "").length;
    const ok = await confirm({ title: "Publish these marks?", confirmLabel: "Publish", message: <>Students and parents will see the marks and get a notification.{missing > 0 && <> <strong>{missing} student{missing === 1 ? " has" : "s have"} no mark yet.</strong></>}</> });
    if (ok) publish.mutate(undefined);
  };

  return (
    <>
      <p className="mb-3 text-sm"><Link to="/gradebook" className="text-muted underline">← Gradebook</Link></p>
      <PageHeader title={as.name} subtitle={<span className="flex flex-wrap items-center gap-2">{as.section_label} · {as.subject_name} · {label(as.kind)} · {fmtDate(as.date)} <StatusBadge status={as.is_published ? "published" : "draft"} /></span>}
        actions={<>
          {!as.is_published && <Button variant="secondary" onClick={() => { setErrors({}); setEditing(true); }}>Edit details</Button>}
          {!as.is_published && <Button variant="ghost" onClick={async () => { if (await confirm({ title: "Delete this assessment?", message: "All marks entered for it will be deleted.", confirmLabel: "Delete", danger: true })) remove.mutate(undefined); }}>Delete</Button>}
          {!as.is_published && <Button onClick={onPublish} loading={publish.isPending}>Publish</Button>}
        </>} />
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Out of" value={max} hint={`Weight ${num(as.weight)}`} />
        <Stat label="Marks entered" value={`${values.length} / ${students.length}`} />
        <Stat label="Average" value={values.length ? (values.reduce((x, y) => x + y, 0) / values.length).toFixed(1) : "—"} />
        <Stat label="Highest / lowest" value={values.length ? `${Math.max(...values)} / ${Math.min(...values)}` : "—"} />
      </dl>
      {as.is_published && <p className="mb-4 rounded-md bg-chalk-soft px-4 py-2 text-sm">Published {fmtDate(as.published_at)}. Changing a mark now updates what families see, and the change is recorded in the audit log.</p>}
      <Card flush>
        <table className="w-full">
          <thead className="border-b border-line"><tr><th className="th">Student</th><th className="th w-40">Mark (out of {max})</th><th className="th">Remarks</th></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className={`border-b border-line last:border-0 ${dirty.has(s.id) ? "bg-chalk-soft/50" : ""}`}>
                <td className="td"><span className="font-medium">{s.name}</span><span className="ml-2 text-xs text-muted">{s.code}</span></td>
                <td className="td"><Input type="number" inputMode="decimal" step="0.25" min={0} max={max} aria-label={`Mark for ${s.name}`} invalid={!!rowErrors[s.id]} value={entries[s.id]?.score ?? ""} onChange={(e) => setField(s.id, { score: e.target.value })} />
                  {rowErrors[s.id] && <span className="text-xs text-absent">{rowErrors[s.id]}</span>}</td>
                <td className="td"><Input maxLength={255} aria-label={`Remarks for ${s.name}`} placeholder="Optional" value={entries[s.id]?.remarks ?? ""} onChange={(e) => setField(s.id, { remarks: e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="sticky bottom-0 mt-4 flex items-center gap-3 border-t border-line bg-paper/95 py-3 backdrop-blur">
        <Button onClick={onSave} loading={save.isPending} disabled={!dirty.size}>Save marks{dirty.size ? ` (${dirty.size})` : ""}</Button>
        {dirty.size > 0 && <span className="text-sm text-muted">Unsaved changes</span>}
      </div>
      <ErrorNote message={error} />
      {editing && (
        <FormModal open mode="edit" title="Edit assessment" errors={errors} saving={update.isPending} onClose={() => setEditing(false)}
          fields={[
            { name: "name", label: "Name", type: "text", required: true, wide: true },
            { name: "kind", label: "Type", type: "select", required: true, options: KINDS },
            { name: "term", label: "Term", type: "select", remote: { endpoint: "terms", text: (t: Term) => t.name } },
            { name: "max_score", label: "Maximum score", type: "number", required: true, step: "0.01" },
            { name: "weight", label: "Weight", type: "number", step: "0.01" },
            { name: "date", label: "Date", type: "date", required: true },
            { name: "subject", label: "Subject", type: "select", required: true, remote: { endpoint: "subjects", text: (s: Subject) => s.name } },
          ]}
          initialValues={{ name: as.name, kind: as.kind, term: as.term ?? "", max_score: as.max_score, weight: as.weight, date: as.date, subject: as.subject }}
          onSubmit={(p) => update.mutate({ ...p, section: as.section }, { onError: (e) => setErrors(formErrors(e)) })} />
      )}
    </>
  );
}
