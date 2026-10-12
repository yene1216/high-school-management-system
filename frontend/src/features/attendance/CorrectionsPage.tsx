import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import type { Correction } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { MANAGEMENT } from "../../auth/roles";
import { AttendancePill } from "../../components/domain/Attendance";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, StatusBadge } from "../../components/ui/Feedback";
import { PageHeader, Tabs } from "../../components/ui/Layout";
import { Column, DataTable, Pagination } from "../../components/ui/Table";
import { fmtDate, fmtDateTime } from "../../lib/format";

export default function CorrectionsPage() {
  const user = useUser();
  const canReview = MANAGEMENT.includes(user.role);
  const [state, setState] = useState("pending");
  const [page, setPage] = useState(1);
  const q = useList<Correction>("attendance-corrections", { state, page, page_size: 25 });
  const review = useAction((v: { id: number; approve: boolean }) => api(`/attendance-corrections/${v.id}/review/`, { method: "POST", json: { approve: v.approve } }), { success: "Done." });

  const columns: Column<Correction>[] = [
    { key: "s", header: "Student", cell: (c) => <span className="font-medium">{c.student_name}</span> },
    { key: "d", header: "Day", cell: (c) => fmtDate(c.date) },
    { key: "ch", header: "Change", cell: (c) => <span className="flex items-center gap-1.5"><AttendancePill status={c.old_status} /> → <AttendancePill status={c.new_status} /></span> },
    { key: "r", header: "Reason", cell: (c) => c.reason },
    { key: "st", header: state === "pending" ? "Requested" : "State", cell: (c) => (state === "pending" ? fmtDateTime(c.created_at) : <StatusBadge status={c.state} />) },
    ...(canReview && state === "pending" ? [{ key: "a", header: "", align: "right" as const, cell: (c: Correction) => (
      <span className="flex justify-end gap-2"><Button small loading={review.isPending} onClick={() => review.mutate({ id: c.id, approve: true })}>Approve</Button><Button small variant="secondary" onClick={() => review.mutate({ id: c.id, approve: false })}>Reject</Button></span>) }] : []),
  ];

  return (
    <>
      <PageHeader title="Attendance corrections" subtitle={canReview ? "Approving applies the change and notifies the family if it makes a student absent or late. You can't approve your own request." : "Requests you or your colleagues have raised. A school admin or principal reviews them."} />
      <Tabs active={state} onChange={(s) => { setState(s); setPage(1); }} tabs={[{ id: "pending", label: "Waiting for review" }, { id: "approved", label: "Approved" }, { id: "rejected", label: "Rejected" }]} />
      {q.isError ? <ErrorNote message="Couldn't load corrections." /> : (
        <>
          <DataTable columns={columns} rows={q.data?.results} rowKey={(c) => c.id} loading={q.isLoading} empty={<EmptyState title="Nothing here">{state === "pending" ? "No corrections are waiting for review." : "No corrections in this list yet."}</EmptyState>} />
          <Pagination page={page} pageSize={25} count={q.data?.count ?? 0} onChange={setPage} />
        </>
      )}
      <p className="mt-4 text-sm text-muted">To request a correction, open a <Link className="underline" to="/students">student</Link> and use their Attendance tab.</p>
    </>
  );
}
