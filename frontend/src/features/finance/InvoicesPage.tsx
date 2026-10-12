import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formErrors } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import type { AcademicYear, GradeLevel, Invoice } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { CASHIERS, FAMILY } from "../../auth/roles";
import { FormModal } from "../../components/crud/ResourceManager";
import { RemoteSelect } from "../../components/domain/Pickers";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, StatusBadge, useToast } from "../../components/ui/Feedback";
import { Input, Select } from "../../components/ui/Form";
import { PageHeader } from "../../components/ui/Layout";
import { Column, DataTable, Pagination } from "../../components/ui/Table";
import { useI18n } from "../../i18n";
import { addDays, fmtDate, localISODate, money } from "../../lib/format";
import { useDebounced } from "../../lib/useDebounced";

export default function InvoicesPage() {
  const user = useUser();
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const canBill = CASHIERS.includes(user.role);
  const family = FAMILY.includes(user.role);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [dlg, setDlg] = useState<"" | "one" | "bulk">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const search = useDebounced(term, 300);
  const q = useList<Invoice>("invoices", { search: search || undefined, status: status || undefined, academic_year: year || undefined, page, page_size: 25 });
  const close = () => { setDlg(""); setErrors({}); };
  const onErr = (e: unknown) => setErrors(formErrors(e));

  const one = useAction((p: Record<string, unknown>) => api<Invoice>("/invoices/generate/", { method: "POST", json: p }), { silentError: true, success: "Invoice created.", onSuccess: (i) => { close(); navigate(`/invoices/${i.id}`); } });
  const bulk = useAction((p: Record<string, unknown>) => api<{ created: number; skipped_existing: number }>("/invoices/bulk-generate/", { method: "POST", json: p }), {
    silentError: true, onSuccess: (r) => { close(); toast.success(`Created ${r.created} invoice${r.created === 1 ? "" : "s"}${r.skipped_existing ? `; ${r.skipped_existing} already existed` : ""}.`); },
  });

  const columns: Column<Invoice>[] = [
    { key: "n", header: "Invoice", cell: (i) => <Link className="font-medium hover:underline" to={`/invoices/${i.id}`}>{i.number ?? `Draft #${i.id}`}</Link> },
    { key: "s", header: "Student", cell: (i) => i.student_name },
    { key: "d", header: "Due", cell: (i) => fmtDate(i.due_date) },
    { key: "st", header: "Status", cell: (i) => <StatusBadge status={i.is_overdue ? "overdue" : i.status} /> },
    { key: "t", header: "Total", align: "right", cell: (i) => money(i.total, i.currency) },
    { key: "b", header: "Balance", align: "right", cell: (i) => <span className={i.is_overdue ? "font-semibold text-absent" : "font-medium"}>{money(i.balance, i.currency)}</span> },
  ];

  return (
    <>
      <PageHeader title={t("nav.invoices", "Invoices")} subtitle={family ? "Fees for your children. Pay at the school office or by bank transfer, and quote the invoice number." : undefined}
        actions={canBill ? <><Button variant="secondary" onClick={() => { setErrors({}); setDlg("bulk"); }}>Invoice a grade</Button><Button onClick={() => { setErrors({}); setDlg("one"); }}>Create invoice</Button></> : undefined} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="Search invoice or student…" aria-label="Search invoices" value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }} />
        <Select className="w-40" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option>{(canBill ? ["draft", "issued", "partial", "paid", "void"] : ["issued", "partial", "paid", "void"]).map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <div className="w-40"><RemoteSelect endpoint="academic-years" value={year} onChange={(v) => { setYear(v); setPage(1); }} text={(y: AcademicYear) => y.name} placeholder="Any year" /></div>
      </div>
      {q.isError ? <ErrorNote message="Couldn't load invoices." /> : (
        <>
          <DataTable columns={columns} rows={q.data?.results} rowKey={(i) => i.id} loading={q.isLoading} onRowClick={(i) => navigate(`/invoices/${i.id}`)}
            empty={<EmptyState title="No invoices found">{canBill ? "Create one, or invoice a whole grade at once." : "Invoices appear here when the school issues them."}</EmptyState>} />
          <Pagination page={page} pageSize={25} count={q.data?.count ?? 0} onChange={setPage} />
        </>
      )}
      {dlg === "one" && (
        <FormModal open mode="create" title="Create invoice" errors={errors} saving={one.isPending} submitLabel="Create" onClose={close}
          fields={[
            { name: "student", label: "Student", type: "student", required: true, wide: true },
            { name: "academic_year", label: "Academic year", type: "select", required: true, remote: { endpoint: "academic-years", text: (y: AcademicYear) => y.name } },
            { name: "due_date", label: "Due date", type: "date", required: true },
            { name: "issue", label: "Issue immediately and notify the family", type: "checkbox", wide: true },
          ]}
          initialValues={{ due_date: addDays(localISODate(), 14), issue: true }} onSubmit={(p) => one.mutate(p, { onError: onErr })} />
      )}
      {dlg === "bulk" && (
        <FormModal open mode="create" title="Invoice a whole grade" errors={errors} saving={bulk.isPending} submitLabel="Generate" onClose={close}
          fields={[
            { name: "academic_year", label: "Academic year", type: "select", required: true, remote: { endpoint: "academic-years", text: (y: AcademicYear) => y.name } },
            { name: "grade_level", label: "Grade", type: "select", required: true, remote: { endpoint: "grade-levels", text: (g: GradeLevel) => g.name } },
            { name: "due_date", label: "Due date", type: "date", required: true },
            { name: "issue", label: "Issue immediately and notify families", type: "checkbox", wide: true },
          ]}
          initialValues={{ due_date: addDays(localISODate(), 14), issue: true }} onSubmit={(p) => bulk.mutate(p, { onError: onErr })} />
      )}
    </>
  );
}
