import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import type { Refund } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, StatusBadge } from "../../components/ui/Feedback";
import { PageHeader, Tabs } from "../../components/ui/Layout";
import { Column, DataTable, Pagination } from "../../components/ui/Table";
import { useI18n } from "../../i18n";
import { fmtDate, money } from "../../lib/format";

export default function RefundsPage() {
  const { t } = useI18n();
  const [state, setState] = useState("requested");
  const [page, setPage] = useState(1);
  const q = useList<Refund>("refunds", { state, page, page_size: 25 });
  const decide = useAction((v: { id: number; approve: boolean }) => api(`/refunds/${v.id}/decide/`, { method: "POST", json: { approve: v.approve } }), { success: "Decision saved." });
  const columns: Column<Refund>[] = [
    { key: "d", header: "Requested", cell: (r) => fmtDate(r.created_at) },
    { key: "p", header: "Payment", cell: (r) => <Link className="hover:underline" to={`/payments/${r.payment}/receipt`}>#{r.payment}</Link> },
    { key: "a", header: "Amount", align: "right", cell: (r) => <span className="font-medium">{money(r.amount)}</span> },
    { key: "r", header: "Reason", cell: (r) => r.reason },
    { key: "s", header: "State", cell: (r) => <StatusBadge status={r.state} /> },
    ...(state === "requested" ? [{ key: "x", header: "", align: "right" as const, cell: (r: Refund) => (
      <span className="flex justify-end gap-2"><Button small loading={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true })}>Approve</Button><Button small variant="secondary" onClick={() => decide.mutate({ id: r.id, approve: false })}>Reject</Button></span>) }] : []),
  ];
  return (
    <>
      <PageHeader title={t("nav.refunds", "Refunds")} subtitle="A refund must be approved by someone other than the person who requested it. Request one from an invoice's payment list." />
      <Tabs active={state} onChange={(s) => { setState(s); setPage(1); }} tabs={[{ id: "requested", label: "Waiting for approval" }, { id: "approved", label: "Approved" }, { id: "rejected", label: "Rejected" }]} />
      {q.isError ? <ErrorNote message="Couldn't load refunds." /> : (
        <>
          <DataTable columns={columns} rows={q.data?.results} rowKey={(r) => r.id} loading={q.isLoading} empty={<EmptyState title="No refunds here" />} />
          <Pagination page={page} pageSize={25} count={q.data?.count ?? 0} onChange={setPage} />
        </>
      )}
    </>
  );
}
