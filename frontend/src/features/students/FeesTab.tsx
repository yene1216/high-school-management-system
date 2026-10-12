import { useState } from "react";
import { Link } from "react-router-dom";
import { api, formErrors } from "../../api/client";
import { useAction, useItem, useList } from "../../api/hooks";
import type { AcademicYear, Discount, Invoice, Student, StudentDiscount } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { CASHIERS } from "../../auth/roles";
import { FormModal } from "../../components/crud/ResourceManager";
import { Ref } from "../../components/domain/Pickers";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, Spinner, StatusBadge } from "../../components/ui/Feedback";
import { Card } from "../../components/ui/Layout";
import { addDays, fmtDate, localISODate, money } from "../../lib/format";

export function FeesTab({ student }: { student: Student }) {
  const user = useUser();
  const canBill = CASHIERS.includes(user.role);
  const q = useItem<Invoice[]>(`/students/${student.id}/invoices/`);
  const discounts = useList<StudentDiscount>("student-discounts", { student: student.id }, canBill);
  const [dlg, setDlg] = useState<"" | "invoice" | "discount">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const close = () => { setDlg(""); setErrors({}); };
  const onErr = (e: unknown) => setErrors(formErrors(e));

  const generate = useAction((v: Record<string, unknown>) => api<Invoice>("/invoices/generate/", { method: "POST", json: { ...v, student: student.id } }), { silentError: true, success: "Invoice created.", onSuccess: close });
  const assign = useAction((v: Record<string, unknown>) => api("/student-discounts/", { method: "POST", json: { ...v, student: student.id } }), { silentError: true, success: "Discount assigned.", onSuccess: close });
  const unassign = useAction((id: number) => api(`/student-discounts/${id}/`, { method: "DELETE" }), { success: "Discount removed." });

  if (q.isLoading) return <Spinner />;
  const rows = q.data ?? [];
  return (
    <div className="space-y-5">
      {canBill && <div className="flex gap-2"><Button onClick={() => { setErrors({}); setDlg("invoice"); }}>Create invoice</Button><Button variant="secondary" onClick={() => { setErrors({}); setDlg("discount"); }}>Assign scholarship / discount</Button></div>}
      {q.isError ? <ErrorNote message="Couldn't load invoices." /> : rows.length === 0 ? <EmptyState title="No invoices yet" /> : (
        <Card flush>
          <table className="w-full">
            <thead className="border-b border-line"><tr><th className="th">Invoice</th><th className="th">Due</th><th className="th">Status</th><th className="th text-right">Total</th><th className="th text-right">Balance</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-b border-line last:border-0">
                  <td className="td"><Link className="font-medium underline-offset-2 hover:underline" to={`/invoices/${i.id}`}>{i.number ?? `Draft #${i.id}`}</Link></td>
                  <td className="td">{fmtDate(i.due_date)}</td>
                  <td className="td"><StatusBadge status={i.is_overdue ? "overdue" : i.status} /></td>
                  <td className="td text-right">{money(i.total, i.currency)}</td>
                  <td className={`td text-right font-medium ${i.is_overdue ? "text-absent" : ""}`}>{money(i.balance, i.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {canBill && (discounts.data?.results.length ?? 0) > 0 && (
        <Card title="Scholarships and discounts">
          <ul className="divide-y divide-line text-sm">
            {discounts.data!.results.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <span><Ref<Discount> endpoint="discounts" id={d.discount} text={(x) => `${x.name} (${x.kind === "percent" ? `${Number(x.value)}%` : money(x.value)})`} /> <span className="text-muted">· from {fmtDate(d.valid_from)}{d.valid_to ? ` to ${fmtDate(d.valid_to)}` : ""}</span></span>
                <Button variant="ghost" small onClick={() => unassign.mutate(d.id)}>Remove</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {dlg === "invoice" && (
        <FormModal open mode="create" title={`Create invoice for ${student.first_name}`} errors={errors} saving={generate.isPending} submitLabel="Create" onClose={close}
          fields={[
            { name: "academic_year", label: "Academic year", type: "select", required: true, remote: { endpoint: "academic-years", text: (y: AcademicYear) => y.name } },
            { name: "due_date", label: "Due date", type: "date", required: true },
            { name: "issue", label: "Issue immediately and notify the family", type: "checkbox", wide: true },
          ]}
          initialValues={{ due_date: addDays(localISODate(), 14), issue: true }} onSubmit={(p) => generate.mutate(p, { onError: onErr })} />
      )}
      {dlg === "discount" && (
        <FormModal open mode="create" title="Assign a discount" errors={errors} saving={assign.isPending} submitLabel="Assign" onClose={close}
          fields={[
            { name: "discount", label: "Discount", type: "select", required: true, wide: true, remote: { endpoint: "discounts", text: (d: Discount) => `${d.name} (${d.kind === "percent" ? `${Number(d.value)}%` : d.value})` } },
            { name: "valid_from", label: "Valid from", type: "date", required: true },
            { name: "valid_to", label: "Valid until (optional)", type: "date" },
          ]}
          initialValues={{ valid_from: localISODate() }} onSubmit={(p) => assign.mutate(p, { onError: onErr })} />
      )}
    </div>
  );
}
