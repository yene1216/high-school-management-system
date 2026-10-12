import { Link, useParams } from "react-router-dom";
import { useItem } from "../../api/hooks";
import type { Receipt } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { ErrorNote, Spinner } from "../../components/ui/Feedback";
import { fmtDate, fmtDateTime, label, money } from "../../lib/format";

export default function ReceiptPage() {
  const { id } = useParams();
  const q = useItem<Receipt>(`/payments/${id}/receipt/`);
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorNote message="Couldn't load this receipt." />;
  const r = q.data;
  const p = r.payment;
  return (
    <div className="mx-auto max-w-xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to={`/invoices/${p.invoice}`} className="text-sm text-muted underline">← Invoice</Link>
        <Button onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>
      <article className="card print-sheet p-8">
        <header className="border-b border-line pb-4 text-center">
          <p className="font-display text-2xl font-semibold">{r.school}</p>
          <p className="mt-1 text-sm uppercase tracking-widest text-muted">Payment receipt</p>
        </header>
        <dl className="mt-5 space-y-2 text-sm">
          {[["Receipt no.", r.number], ["Issued", fmtDateTime(r.issued_at)], ["Student", r.student], ["Invoice", p.invoice_number ?? "—"], ["Date received", fmtDate(p.paid_on)], ["Method", label(p.method)], ["Reference", p.reference || "—"]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line pb-2"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-6 flex items-baseline justify-between"><span className="text-sm uppercase tracking-wide text-muted">Amount received</span><span className="font-display text-3xl font-semibold">{money(p.amount, r.currency)}</span></p>
        <p className="mt-8 text-center text-xs text-muted">Thank you. Keep this receipt for your records.</p>
      </article>
    </div>
  );
}
