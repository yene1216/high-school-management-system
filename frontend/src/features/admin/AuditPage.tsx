import { useState } from "react";
import { useList } from "../../api/hooks";
import type { AuditEntry } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote } from "../../components/ui/Feedback";
import { Input } from "../../components/ui/Form";
import { PageHeader } from "../../components/ui/Layout";
import { Column, DataTable, Pagination } from "../../components/ui/Table";
import { fmtDateTime } from "../../lib/format";
import { useDebounced } from "../../lib/useDebounced";

export default function AuditPage() {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const search = useDebounced(term, 300);
  const q = useList<AuditEntry>("audit-logs", { search: search || undefined, page, page_size: 30 });
  const columns: Column<AuditEntry>[] = [
    { key: "t", header: "When", cell: (e) => <span className="whitespace-nowrap">{fmtDateTime(e.created_at)}</span> },
    { key: "a", header: "Who", cell: (e) => e.actor_name ?? <span className="text-muted">System</span> },
    { key: "x", header: "Action", cell: (e) => <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs">{e.action}</code> },
    { key: "o", header: "Record", cell: (e) => (e.object_type ? `${e.object_type} #${e.object_id}` : "—") },
    { key: "ip", header: "IP", cell: (e) => <span className="text-muted">{e.ip_address ?? "—"}</span> },
    { key: "d", header: "", align: "right", cell: (e) => Object.keys(e.changes ?? {}).length ? <Button variant="ghost" small onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? "Hide" : "Details"}</Button> : null },
  ];
  const rows = q.data?.results;
  return (
    <>
      <PageHeader title="Audit log" subtitle="Who did what, and when. Entries can't be edited or deleted." />
      <div className="mb-4"><Input className="max-w-sm" placeholder="Search actions, e.g. refund or grade…" aria-label="Search audit log" value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }} /></div>
      {q.isError ? <ErrorNote message="Couldn't load the audit log." /> : (
        <>
          <DataTable columns={columns} rows={rows} rowKey={(e) => e.id} loading={q.isLoading} empty={<EmptyState title="No matching entries" />} />
          {open !== null && rows?.find((r) => r.id === open) && <pre className="card mt-3 overflow-x-auto p-4 text-xs">{JSON.stringify(rows.find((r) => r.id === open)?.changes, null, 2)}</pre>}
          <Pagination page={page} pageSize={30} count={q.data?.count ?? 0} onChange={setPage} />
        </>
      )}
    </>
  );
}
