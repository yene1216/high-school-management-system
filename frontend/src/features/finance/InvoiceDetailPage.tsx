import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, formErrors } from "../../api/client";
import { useAction, useItem, useList } from "../../api/hooks";
import type { Invoice, Payment } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { CASHIERS } from "../../auth/roles";
import { FormModal } from "../../components/crud/ResourceManager";
import { Button } from "../../components/ui/Button";
import { ErrorNote, Spinner, StatusBadge, useConfirm } from "../../components/ui/Feedback";
import { Card, PageHeader, Stat } from "../../components/ui/Layout";
import { fmtDate, label, localISODate, money, num } from "../../lib/format";

const METHODS = [{ value: "cash", label: "Cash" }, { value: "bank_transfer", label: "Bank transfer" }, { value: "mobile_money", label: "Mobile money" }];

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const user = useUser();
  const confirm = useConfirm();
  const canBill = CASHIERS.includes(user.role);
  const q = useItem<Invoice>(`/invoices/${id}/`);
  const pays = useList<Payment>("payments", { invoice: id, page_size: 100 });
  const [dlg, setDlg] = useState<"" | "pay" | "void" | { refund: Payment }>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const close = () => { setDlg(""); setErrors({}); };
  const onErr = (e: unknown) => setErrors(formErrors(e));

  const issue = useAction(() => api(`/invoices/${id}/issue/`, { method: "POST" }), { success: "Invoice issued. The family has been notified." });
  const pay = useAction((p: Record<string, unknown>) => api("/payments/", { method: "POST", json: { ...p, invoice: Number(id) } }), { silentError: true, success: "Payment recorded.", onSuccess: close });
  const voidIt = useAction((p: Record<string, unknown>) => api(`/invoices/${id}/void/`, { method: "POST", json: p }), { silentError: true, success: "Invoice voided.", onSuccess: close });
  const refund = useAction((p: Record<string, unknown>) => api("/refunds/", { method: "POST", json: p }), { silentError: true, success: "Refund requested. Another person must approve it.", onSuccess: close });

  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorNote message={q.error instanceof ApiError && q.error.status === 404 ? "This invoice wasn't found, or you don't have access." : "Couldn't load this invoice."} />;
  const inv = q.data;
  const open = inv.status === "issued" || inv.status === "partial";

  return (
    <>
      <p className="no-print mb-3 text-sm"><Link to="/invoices" className="text-muted underline">← Invoices</Link></p>
      <PageHeader title={inv.number ?? `Draft invoice #${inv.id}`}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Link className="underline" to={`/students/${inv.student}`}>{inv.student_name}</Link> · due {fmtDate(inv.due_date)} <StatusBadge status={inv.is_overdue ? "overdue" : inv.status} /></span>}
        actions={<>
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
          {canBill && inv.status === "draft" && <Button loading={issue.isPending} onClick={async () => { if (await confirm({ title: "Issue this invoice?", message: "The family will be notified.", confirmLabel: "Issue" })) issue.mutate(undefined); }}>Issue</Button>}
          {canBill && open && <Button onClick={() => { setErrors({}); setDlg("pay"); }}>Record payment</Button>}
          {canBill && inv.status !== "void" && inv.status !== "paid" && num(inv.amount_paid) === 0 && <Button variant="ghost" onClick={() => { setErrors({}); setDlg("void"); }}>Void</Button>}
        </>} />
      <dl className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Total" value={money(inv.total, inv.currency)} />
        <Stat label="Paid" value={money(inv.amount_paid, inv.currency)} tone="good" />
        <Stat label="Balance" value={money(inv.balance, inv.currency)} tone={inv.is_overdue ? "bad" : undefined} />
      </dl>
      <Card title="Charges" flush className="print-sheet">
        <table className="w-full">
          <thead className="border-b border-line"><tr><th className="th">Description</th><th className="th">Type</th><th className="th text-right">Amount</th></tr></thead>
          <tbody>
            {inv.items.map((i) => <tr key={i.id} className="border-b border-line last:border-0"><td className="td">{i.description}</td><td className="td text-muted">{label(i.kind)}</td><td className={`td text-right ${num(i.amount) < 0 ? "text-present" : ""}`}>{money(i.amount, inv.currency)}</td></tr>)}
            <tr className="bg-paper/60"><td className="td font-semibold" colSpan={2}>Total</td><td className="td text-right font-semibold">{money(inv.total, inv.currency)}</td></tr>
          </tbody>
        </table>
      </Card>
      <Card title="Payments" flush className="mt-5">
        {!pays.data?.results.length ? <p className="p-5 text-sm text-muted">No payments recorded.</p> : (
          <table className="w-full">
            <thead className="border-b border-line"><tr><th className="th">Date</th><th className="th">Method</th><th className="th">Reference</th><th className="th text-right">Amount</th><th className="th" /></tr></thead>
            <tbody>
              {pays.data.results.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="td">{fmtDate(p.paid_on)}</td><td className="td">{label(p.method)}</td><td className="td text-muted">{p.reference || "—"}</td><td className="td text-right font-medium">{money(p.amount, inv.currency)}</td>
                  <td className="td text-right"><span className="no-print flex justify-end gap-2"><Link className="btn btn-secondary btn-sm" to={`/payments/${p.id}/receipt`}>Receipt</Link>{canBill && <Button variant="ghost" small onClick={() => { setErrors({}); setDlg({ refund: p }); }}>Refund</Button>}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dlg === "pay" && (
        <FormModal open mode="create" title="Record a payment" errors={errors} saving={pay.isPending} submitLabel="Save payment" onClose={close}
          fields={[
            { name: "amount", label: `Amount (${inv.currency})`, type: "number", required: true, step: "0.01", hint: `Outstanding: ${money(inv.balance, inv.currency)}` },
            { name: "method", label: "Method", type: "select", required: true, options: METHODS },
            { name: "paid_on", label: "Date received", type: "date", required: true },
            { name: "reference", label: "Reference", type: "text", hint: "Bank slip or transaction number" },
            { name: "notes", label: "Notes", type: "text", wide: true },
          ]}
          initialValues={{ amount: inv.balance, method: "cash", paid_on: localISODate() }} onSubmit={(p) => pay.mutate(p, { onError: onErr })} />
      )}
      {dlg === "void" && (
        <FormModal open mode="create" title="Void this invoice" errors={errors} saving={voidIt.isPending} submitLabel="Void invoice" onClose={close}
          fields={[{ name: "reason", label: "Reason", type: "text", required: true, wide: true }]} initialValues={{}} onSubmit={(p) => voidIt.mutate(p, { onError: onErr })} />
      )}
      {typeof dlg === "object" && (
        <FormModal open mode="create" title={`Request a refund`} errors={errors} saving={refund.isPending} submitLabel="Request refund" onClose={close}
          fields={[
            { name: "amount", label: `Amount (max ${money(dlg.refund.amount, inv.currency)})`, type: "number", required: true, step: "0.01" },
            { name: "reason", label: "Reason", type: "text", required: true, wide: true },
          ]}
          initialValues={{ amount: dlg.refund.amount }} onSubmit={(p) => refund.mutate({ ...p, payment: (dlg as { refund: Payment }).refund.id }, { onError: onErr })} />
      )}
    </>
  );
}
