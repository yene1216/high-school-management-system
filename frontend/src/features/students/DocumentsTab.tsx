import { useState } from "react";
import { api, downloadFile, formErrors } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import type { Student, StudentDocument } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { REGISTRY } from "../../auth/roles";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, Spinner, StatusBadge, useToast } from "../../components/ui/Feedback";
import { Field, FileField, Input } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { Column, DataTable } from "../../components/ui/Table";
import { errorText } from "../../api/client";
import { fmtDate } from "../../lib/format";

export function DocumentsTab({ student }: { student: Student }) {
  const user = useUser();
  const toast = useToast();
  const canManage = REGISTRY.includes(user.role);
  const q = useList<StudentDocument>("student-documents", { student: student.id, page_size: 100 });
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const upload = useAction(() => {
    const f = new FormData();
    f.append("student", String(student.id)); f.append("doc_type", type.trim()); f.append("file", file as File);
    return api("/student-documents/", { method: "POST", form: f });
  }, { silentError: true, success: "Document uploaded.", onSuccess: () => { setOpen(false); setType(""); setFile(null); } });
  const verify = useAction((v: { id: number; status: "verified" | "rejected" }) => api(`/student-documents/${v.id}/verify/`, { method: "POST", json: { status: v.status } }), { success: "Document updated." });
  const remove = useAction((id: number) => api(`/student-documents/${id}/`, { method: "DELETE" }), { success: "Document deleted." });

  const columns: Column<StudentDocument>[] = [
    { key: "t", header: "Document", cell: (d) => <span className="font-medium">{d.doc_type}</span> },
    { key: "s", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
    { key: "d", header: "Uploaded", cell: (d) => fmtDate(d.created_at) },
    { key: "a", header: "", align: "right", cell: (d) => (
      <span className="flex justify-end gap-2">
        <Button variant="secondary" small onClick={() => downloadFile(d.download_url.replace(/^\/api\/v1/, ""), `${d.doc_type}-${d.id}`).catch((e) => toast.error(errorText(e)))}>Download</Button>
        {canManage && d.status === "pending" && <><Button small onClick={() => verify.mutate({ id: d.id, status: "verified" })}>Verify</Button><Button variant="ghost" small onClick={() => verify.mutate({ id: d.id, status: "rejected" })}>Reject</Button></>}
        {canManage && <Button variant="ghost" small onClick={() => remove.mutate(d.id)}>Delete</Button>}
      </span>) },
  ];

  if (q.isLoading) return <Spinner />;
  return (
    <div className="space-y-4">
      {canManage && <Button onClick={() => { setErrors({}); setOpen(true); }}>Upload document</Button>}
      {q.isError ? <ErrorNote message="You can't view this student's documents." /> : (
        <DataTable columns={columns} rows={q.data?.results} rowKey={(d) => d.id} empty={<EmptyState title="No documents yet">Birth certificates and other records appear here. They're private and every download is logged.</EmptyState>} />
      )}
      {open && (
        <Modal open title="Upload document" onClose={() => setOpen(false)} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!type.trim() || !file} loading={upload.isPending} onClick={() => upload.mutate(undefined, { onError: (e) => setErrors(formErrors(e)) })}>Upload</Button></>}>
          <div className="space-y-4">
            <Field label="Document type" htmlFor="dt" required error={errors.doc_type}><Input id="dt" value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Birth certificate" /></Field>
            <FileField label="File" accept=".pdf,.png,.jpg,.jpeg" onChange={setFile} error={errors.file} hint="PDF, JPG or PNG, up to 10 MB." />
            <ErrorNote message={errors._} />
          </div>
        </Modal>
      )}
    </div>
  );
}
