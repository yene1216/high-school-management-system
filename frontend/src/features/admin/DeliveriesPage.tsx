import { useState } from "react";
import { useList } from "../../api/hooks";
import type { Delivery } from "../../api/types";
import { EmptyState, ErrorNote, StatusBadge } from "../../components/ui/Feedback";
import { Select } from "../../components/ui/Form";
import { PageHeader } from "../../components/ui/Layout";
import { Column, DataTable, Pagination } from "../../components/ui/Table";
import { fmtDateTime, label } from "../../lib/format";

export default function DeliveriesPage() {
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(1);
  const q = useList<Delivery>("notification-deliveries", { status: status || undefined, channel: channel || undefined, page, page_size: 30 });
  const columns: Column<Delivery>[] = [
    { key: "t", header: "Created", cell: (d) => fmtDateTime(d.created_at) },
    { key: "r", header: "Recipient", cell: (d) => d.recipient },
    { key: "m", header: "Message", cell: (d) => d.title },
    { key: "c", header: "Channel", cell: (d) => label(d.channel) },
    { key: "s", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
    { key: "a", header: "Tries", align: "right", cell: (d) => d.attempts },
    { key: "e", header: "Error", cell: (d) => (d.last_error ? <span className="text-xs text-absent">{d.last_error}</span> : <span className="text-muted">—</span>) },
  ];
  return (
    <>
      <PageHeader title="Message delivery" subtitle="Emails and SMS sent to families and staff, with retry counts. Failed messages are retried automatically." />
      <div className="mb-4 flex gap-3">
        <Select className="w-40" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Any status</option><option value="pending">Pending</option><option value="sent">Sent</option><option value="failed">Failed</option></Select>
        <Select className="w-40" aria-label="Channel" value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }}><option value="">Any channel</option><option value="email">Email</option><option value="sms">SMS</option></Select>
      </div>
      {q.isError ? <ErrorNote message="Couldn't load deliveries." /> : (
        <>
          <DataTable columns={columns} rows={q.data?.results} rowKey={(d) => d.id} loading={q.isLoading} empty={<EmptyState title="No messages yet" />} />
          <Pagination page={page} pageSize={30} count={q.data?.count ?? 0} onChange={setPage} />
        </>
      )}
    </>
  );
}
