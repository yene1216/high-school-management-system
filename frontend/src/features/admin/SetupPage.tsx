import { ChangeEvent, useEffect, useState } from "react";
import { api, formErrors } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import type { AcademicYear, Discount, FeeCategory, FeeStructure, GradeLevel, Section, Subject, TeacherAssignment, Term, User } from "../../api/types";
import { ResourceConfig, ResourceManager } from "../../components/crud/ResourceManager";
import { Ref } from "../../components/domain/Pickers";
import { Button } from "../../components/ui/Button";
import { Badge, ErrorNote, Spinner } from "../../components/ui/Feedback";
import { Field, Input } from "../../components/ui/Form";
import { Card, PageHeader, Tabs, useTabParam } from "../../components/ui/Layout";
import { fmtDate, label, money, num } from "../../lib/format";
import type { School } from "../../api/types";

const yearText = (y: AcademicYear) => y.name;
const gradeText = (g: GradeLevel) => g.name;
const userText = (u: User) => `${u.first_name} ${u.last_name}`.trim() || u.email;
const FREQ = [{ value: "yearly", label: "Yearly" }, { value: "termly", label: "Per term" }, { value: "monthly", label: "Monthly" }, { value: "one_time", label: "One-time" }];

const years: ResourceConfig<AcademicYear> = {
  noun: "academic year", endpoint: "academic-years",
  intro: "Create the school year first. Mark exactly one as current; marking a new one current un-marks the old.",
  columns: [
    { key: "n", header: "Year", cell: (y) => <span className="font-medium">{y.name}</span> }, { key: "s", header: "Starts", cell: (y) => fmtDate(y.start_date) },
    { key: "e", header: "Ends", cell: (y) => fmtDate(y.end_date) }, { key: "c", header: "", cell: (y) => (y.is_current ? <Badge tone="good">Current</Badge> : null) },
  ],
  fields: [
    { name: "name", label: "Name", type: "text", required: true, hint: "e.g. 2026/27" }, { name: "is_current", label: "This is the current year", type: "checkbox" },
    { name: "start_date", label: "Starts", type: "date", required: true }, { name: "end_date", label: "Ends", type: "date", required: true },
  ],
};
const terms: ResourceConfig<Term> = {
  noun: "term", endpoint: "terms", intro: "Terms (or semesters) inside a year. Assessments can be tied to a term for report cards.",
  columns: [
    { key: "n", header: "Term", cell: (t) => <span className="font-medium">{t.name}</span> },
    { key: "y", header: "Year", cell: (t) => <Ref<AcademicYear> endpoint="academic-years" id={t.academic_year} text={yearText} /> },
    { key: "s", header: "Starts", cell: (t) => fmtDate(t.start_date) }, { key: "e", header: "Ends", cell: (t) => fmtDate(t.end_date) },
  ],
  fields: [
    { name: "academic_year", label: "Academic year", type: "select", required: true, remote: { endpoint: "academic-years", text: yearText } },
    { name: "name", label: "Name", type: "text", required: true, hint: "e.g. Term 1" }, { name: "order", label: "Order", type: "number", defaultValue: "1" },
    { name: "start_date", label: "Starts", type: "date", required: true }, { name: "end_date", label: "Ends", type: "date", required: true },
  ],
};
const grades: ResourceConfig<GradeLevel> = {
  noun: "grade", endpoint: "grade-levels", intro: "The levels students move through, e.g. Grade 1 … Grade 12.",
  columns: [{ key: "n", header: "Grade", cell: (g) => <span className="font-medium">{g.name}</span> }, { key: "o", header: "Order", cell: (g) => g.order }],
  fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "order", label: "Order", type: "number", hint: "Lower numbers come first.", defaultValue: "1" }],
};
const sections: ResourceConfig<Section> = {
  noun: "class", endpoint: "sections", intro: "A class is a grade + section letter in a year, e.g. Grade 3 A. Give it a homeroom teacher so they can take attendance.",
  columns: [
    { key: "n", header: "Class", cell: (s) => <span className="font-medium">{s.label}</span> },
    { key: "y", header: "Year", cell: (s) => <Ref<AcademicYear> endpoint="academic-years" id={s.academic_year} text={yearText} /> },
    { key: "t", header: "Homeroom teacher", cell: (s) => <Ref<User> endpoint="users" params={{ role: "teacher" }} id={s.homeroom_teacher} text={userText} /> },
    { key: "c", header: "Students", cell: (s) => `${s.student_count} / ${s.capacity}` },
  ],
  fields: [
    { name: "grade_level", label: "Grade", type: "select", required: true, remote: { endpoint: "grade-levels", text: gradeText } },
    { name: "academic_year", label: "Academic year", type: "select", required: true, remote: { endpoint: "academic-years", text: yearText } },
    { name: "name", label: "Section", type: "text", required: true, hint: "A, B, C…" },
    { name: "homeroom_teacher", label: "Homeroom teacher", type: "select", remote: { endpoint: "users", params: { role: "teacher" }, text: userText } },
    { name: "room", label: "Room", type: "text" }, { name: "capacity", label: "Capacity", type: "number", defaultValue: "40" },
  ],
};
const subjects: ResourceConfig<Subject> = {
  noun: "subject", endpoint: "subjects", search: true,
  columns: [{ key: "n", header: "Subject", cell: (s) => <span className="font-medium">{s.name}</span> }, { key: "c", header: "Code", cell: (s) => <code className="text-xs">{s.code}</code> }],
  fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "code", label: "Code", type: "text", required: true, hint: "Short, e.g. MATH" }],
};
const assignments: ResourceConfig<TeacherAssignment> = {
  noun: "teaching assignment", endpoint: "teacher-assignments", intro: "Who teaches which subject in which class. Teachers can only take attendance for, and grade, classes they're assigned to.",
  columns: [
    { key: "t", header: "Teacher", cell: (a) => <Ref<User> endpoint="users" params={{ role: "teacher" }} id={a.teacher} text={userText} /> },
    { key: "s", header: "Class", cell: (a) => <Ref<Section> endpoint="sections" id={a.section} text={(s) => s.label} /> },
    { key: "u", header: "Subject", cell: (a) => <Ref<Subject> endpoint="subjects" id={a.subject} text={(s) => s.name} /> },
  ],
  fields: [
    { name: "teacher", label: "Teacher", type: "select", required: true, remote: { endpoint: "users", params: { role: "teacher" }, text: userText } },
    { name: "section", label: "Class", type: "select", required: true, remote: { endpoint: "sections", text: (s: Section) => s.label } },
    { name: "subject", label: "Subject", type: "select", required: true, remote: { endpoint: "subjects", text: (s: Subject) => s.name } },
  ],
};
const feeCats: ResourceConfig<FeeCategory> = {
  noun: "fee category", endpoint: "fee-categories", intro: "Kinds of charge: tuition, registration, transport, meals, library…",
  columns: [{ key: "n", header: "Category", cell: (c) => <span className="font-medium">{c.name}</span> }, { key: "c", header: "Code", cell: (c) => <code className="text-xs">{c.code}</code> }],
  fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "code", label: "Code", type: "text", required: true }],
};
const fees: ResourceConfig<FeeStructure> = {
  noun: "fee", endpoint: "fee-structures", intro: "What each grade pays per year. Invoices are built from these lines.",
  columns: [
    { key: "c", header: "Category", cell: (f) => <span className="font-medium">{f.category_name}</span> },
    { key: "g", header: "Grade", cell: (f) => <Ref<GradeLevel> endpoint="grade-levels" id={f.grade_level} text={gradeText} /> },
    { key: "y", header: "Year", cell: (f) => <Ref<AcademicYear> endpoint="academic-years" id={f.academic_year} text={yearText} /> },
    { key: "f", header: "Frequency", cell: (f) => label(f.frequency) }, { key: "a", header: "Amount", align: "right", cell: (f) => money(f.amount) },
    { key: "s", header: "", cell: (f) => (f.is_active ? null : <Badge>Off</Badge>) },
  ],
  fields: [
    { name: "academic_year", label: "Academic year", type: "select", required: true, remote: { endpoint: "academic-years", text: yearText } },
    { name: "grade_level", label: "Grade", type: "select", required: true, remote: { endpoint: "grade-levels", text: gradeText } },
    { name: "category", label: "Category", type: "select", required: true, remote: { endpoint: "fee-categories", text: (c: FeeCategory) => c.name } },
    { name: "amount", label: "Amount", type: "number", required: true, step: "0.01" },
    { name: "frequency", label: "Frequency", type: "select", required: true, options: FREQ, defaultValue: "yearly" },
    { name: "is_active", label: "Include on new invoices", type: "checkbox", defaultValue: true },
  ],
};
const discounts: ResourceConfig<Discount> = {
  noun: "discount", endpoint: "discounts", intro: "Scholarships and promotions. Set “Applies” to sibling to give younger siblings a discount automatically; assign manual ones to a student from their Fees tab.",
  columns: [
    { key: "n", header: "Name", cell: (d) => <span className="font-medium">{d.name}</span> },
    { key: "v", header: "Value", cell: (d) => (d.kind === "percent" ? `${num(d.value)}%` : money(d.value)) },
    { key: "r", header: "Applies", cell: (d) => (d.auto_rule === "sibling" ? "Automatically to younger siblings" : "Assigned manually") },
    { key: "a", header: "", cell: (d) => (d.is_active ? null : <Badge>Off</Badge>) },
  ],
  fields: [
    { name: "name", label: "Name", type: "text", required: true, wide: true },
    { name: "kind", label: "Type", type: "select", required: true, options: [{ value: "percent", label: "Percent" }, { value: "fixed", label: "Fixed amount" }], defaultValue: "percent" },
    { name: "value", label: "Value", type: "number", required: true, step: "0.01" },
    { name: "auto_rule", label: "Applies", type: "select", required: true, options: [{ value: "manual", label: "Assigned manually" }, { value: "sibling", label: "Automatically to younger siblings" }], defaultValue: "manual", wide: true },
    { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
  ],
};

/** The school's own settings: contact details, alert thresholds, late fees and the grading scale. */
function SchoolSettings() {
  const q = useList<School>("schools", { page_size: 1 });
  const school = q.data?.results[0];
  const [v, setV] = useState({ name: "", address: "", phone: "", email: "", currency: "ETB", late_fee_percent: "0", reminder_days_before_due: "3", absence_alert_threshold: "3" });
  const [scale, setScale] = useState<{ min: string; letter: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!school) return;
    setV({ name: school.name, address: school.address, phone: school.phone, email: school.email, currency: school.currency, late_fee_percent: String(school.late_fee_percent), reminder_days_before_due: String(school.reminder_days_before_due), absence_alert_threshold: String(school.absence_alert_threshold) });
    setScale(school.grading_scale.map(([m, l]) => ({ min: String(m), letter: l })));
  }, [school]);
  const save = useAction(() => api(`/schools/${school!.id}/`, { method: "PATCH", json: {
    ...v, late_fee_percent: Number(v.late_fee_percent), reminder_days_before_due: Number(v.reminder_days_before_due), absence_alert_threshold: Number(v.absence_alert_threshold),
    grading_scale: scale.filter((r) => r.letter.trim() && r.min !== "").map((r) => [Number(r.min), r.letter.trim()]).sort((a, b) => (b[0] as number) - (a[0] as number)),
  } }), { silentError: true, success: "School settings saved." });
  if (q.isLoading) return <Spinner />;
  if (!school) return <ErrorNote message="No school is attached to your account." />;
  const set = (k: keyof typeof v) => (e: ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined, { onError: (er) => setErrors(formErrors(er)) }); }}>
      <Card title="School details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="sn" error={errors.name} className="sm:col-span-2"><Input id="sn" value={v.name} onChange={set("name")} /></Field>
          <Field label="Phone" htmlFor="sp"><Input id="sp" value={v.phone} onChange={set("phone")} /></Field>
          <Field label="Email" htmlFor="se" error={errors.email}><Input id="se" type="email" value={v.email} onChange={set("email")} /></Field>
          <Field label="Address" htmlFor="sa" className="sm:col-span-2"><Input id="sa" value={v.address} onChange={set("address")} /></Field>
        </div>
      </Card>
      <Card title="Billing and alerts">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="cu" error={errors.currency}><Input id="cu" maxLength={3} value={v.currency} onChange={set("currency")} /></Field>
          <Field label="Late fee (% of the balance)" htmlFor="lf" hint="Added once to an invoice when it passes its due date. 0 turns it off." error={errors.late_fee_percent}><Input id="lf" type="number" step="0.01" min="0" value={v.late_fee_percent} onChange={set("late_fee_percent")} /></Field>
          <Field label="Remind families this many days before the due date" htmlFor="rd" error={errors.reminder_days_before_due}><Input id="rd" type="number" min="0" value={v.reminder_days_before_due} onChange={set("reminder_days_before_due")} /></Field>
          <Field label="Repeated-absence alert after this many absences in 30 days" htmlFor="at" error={errors.absence_alert_threshold}><Input id="at" type="number" min="0" value={v.absence_alert_threshold} onChange={set("absence_alert_threshold")} /></Field>
        </div>
      </Card>
      <Card title="Grading scale" actions={<Button variant="secondary" small onClick={() => setScale((s) => [...s, { min: "", letter: "" }])}>Add row</Button>}>
        <p className="mb-3 text-sm text-muted">A student gets the letter of the highest row their average reaches. Keep a row starting at 0.</p>
        <div className="space-y-2">
          {scale.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input className="w-28" type="number" min="0" max="100" aria-label="Minimum percent" value={r.min} onChange={(e) => setScale((s) => s.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))} /><span className="text-sm text-muted">% and above →</span>
              <Input className="w-24" aria-label="Letter" maxLength={4} value={r.letter} onChange={(e) => setScale((s) => s.map((x, j) => (j === i ? { ...x, letter: e.target.value } : x)))} />
              <Button variant="ghost" small onClick={() => setScale((s) => s.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
        </div>
      </Card>
      <ErrorNote message={errors._ ?? errors.grading_scale} />
      <Button type="submit" loading={save.isPending}>Save settings</Button>
    </form>
  );
}

const TABS: { id: string; label: string; config?: ResourceConfig<any> }[] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
  { id: "school", label: "School" }, { id: "years", label: "Years", config: years }, { id: "terms", label: "Terms", config: terms },
  { id: "grades", label: "Grades", config: grades }, { id: "classes", label: "Classes", config: sections }, { id: "subjects", label: "Subjects", config: subjects },
  { id: "teaching", label: "Teaching", config: assignments }, { id: "feecats", label: "Fee categories", config: feeCats }, { id: "fees", label: "Fees", config: fees }, { id: "discounts", label: "Discounts", config: discounts },
];

export default function SetupPage() {
  const [tab, setTab] = useTabParam("school");
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  return (
    <>
      <PageHeader title="School setup" subtitle="Set these up roughly in order: school → year → grades → classes → subjects → teaching → fees." />
      <Tabs tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} active={active.id} onChange={setTab} />
      {active.config ? <ResourceManager key={active.id} config={active.config} /> : <SchoolSettings />}
    </>
  );
}
