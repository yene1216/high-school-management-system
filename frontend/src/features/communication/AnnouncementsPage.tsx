import { useState } from "react";
import { api, formErrors } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import type { Announcement, GradeLevel, Section } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { ASSIGNABLE_ROLES, MANAGEMENT, ROLE_LABELS } from "../../auth/roles";
import { FieldDef, FormModal } from "../../components/crud/ResourceManager";
import { Ref } from "../../components/domain/Pickers";
import { Button } from "../../components/ui/Button";
import { Badge, EmptyState, ErrorNote, Spinner, useConfirm } from "../../components/ui/Feedback";
import { Select } from "../../components/ui/Form";
import { PageHeader } from "../../components/ui/Layout";
import { Pagination } from "../../components/ui/Table";
import { useI18n } from "../../i18n";
import { fmtDateTime, label } from "../../lib/format";

export default function AnnouncementsPage() {
  const user = useUser();
  const { t } = useI18n();
  const confirm = useConfirm();
  const isManager = MANAGEMENT.includes(user.role);
  const canPost = isManager || user.role === "teacher";
  const [page, setPage] = useState(1);
  const [priority, setPriority] = useState("");
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const q = useList<Announcement>("announcements", { priority: priority || undefined, page, page_size: 15 });
  const post = useAction((p: Record<string, unknown>) => api("/announcements/", { method: "POST", json: p }), { silentError: true, success: "Announcement published. Recipients are being notified.", onSuccess: () => setOpen(false) });
  const remove = useAction((id: number) => api(`/announcements/${id}/`, { method: "DELETE" }), { success: "Announcement deleted." });

  const audienceOptions = isManager
    ? [{ value: "all", label: "Everyone in the school" }, { value: "role", label: "One role (e.g. all parents)" }, { value: "grade", label: "A grade" }, { value: "section", label: "A class" }]
    : [{ value: "section", label: "One of my classes" }];
  const fields: FieldDef[] = [
    { name: "title", label: "Title", type: "text", required: true, wide: true },
    { name: "body", label: "Message", type: "textarea", required: true, wide: true },
    { name: "priority", label: "Priority", type: "select", required: true, options: [{ value: "info", label: "Normal" }, { value: "warning", label: "Important" }, { value: "urgent", label: "Urgent" }] },
    { name: "audience", label: "Send to", type: "select", required: true, options: audienceOptions },
    { name: "target_role", label: "Role", type: "select", required: true, showWhen: (v) => v.audience === "role", options: ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
    { name: "grade_level", label: "Grade", type: "select", required: true, showWhen: (v) => v.audience === "grade", remote: { endpoint: "grade-levels", text: (g: GradeLevel) => g.name } },
    { name: "section", label: "Class", type: "select", required: true, showWhen: (v) => v.audience === "section", remote: { endpoint: "sections", text: (s: Section) => s.label } },
  ];

  return (
    <>
      <PageHeader title={t("nav.announcements", "Announcements")} actions={canPost ? <Button onClick={() => { setErrors({}); setOpen(true); }}>New announcement</Button> : undefined} />
      <div className="mb-4"><Select className="w-44" aria-label="Priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}><option value="">Any priority</option><option value="info">Normal</option><option value="warning">Important</option><option value="urgent">Urgent</option></Select></div>
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorNote message="Couldn't load announcements." /> : !q.data?.results.length ? <EmptyState title="No announcements yet" /> : (
        <ul className="space-y-3">
          {q.data.results.map((a) => (
            <li key={a.id} className={`card border-l-4 p-5 ${a.priority === "urgent" ? "border-l-absent" : a.priority === "warning" ? "border-l-late" : "border-l-line"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">{a.title}{a.priority !== "info" && <Badge tone={a.priority === "urgent" ? "bad" : "warn"}>{a.priority === "urgent" ? "Urgent" : "Important"}</Badge>}</h2>
                  <p className="text-xs text-muted">{fmtDateTime(a.published_at)} · to {a.audience === "all" ? "everyone" : a.audience === "role" ? `all ${label(a.target_role)}s` : a.audience === "grade" ? <Ref<GradeLevel> endpoint="grade-levels" id={a.grade_level} text={(g) => g.name} /> : <Ref<Section> endpoint="sections" id={a.section} text={(s) => s.label} />}</p>
                </div>
                {isManager && <Button variant="ghost" small onClick={async () => { if (await confirm({ title: "Delete this announcement?", confirmLabel: "Delete", danger: true })) remove.mutate(a.id); }}>Delete</Button>}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pageSize={15} count={q.data?.count ?? 0} onChange={setPage} />
      {open && <FormModal open mode="create" title="New announcement" fields={fields} errors={errors} saving={post.isPending} submitLabel="Publish" onClose={() => setOpen(false)}
        initialValues={{ priority: "info", audience: isManager ? "all" : "section" }} onSubmit={(p) => post.mutate(p, { onError: (e) => setErrors(formErrors(e)) })} />}
    </>
  );
}
