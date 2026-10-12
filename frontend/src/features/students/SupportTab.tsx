import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAction, useItem } from "../../api/hooks";
import type { Student, SupportRecord } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { ErrorNote, Spinner } from "../../components/ui/Feedback";
import { Field, Textarea } from "../../components/ui/Form";
import { Card } from "../../components/ui/Layout";

export function SupportTab({ student }: { student: Student }) {
  const q = useItem<SupportRecord>(`/students/${student.id}/support-record/`);
  const [v, setV] = useState({ medical_notes: "", allergies: "", support_notes: "" });
  useEffect(() => { if (q.data) setV({ medical_notes: q.data.medical_notes, allergies: q.data.allergies, support_notes: q.data.support_notes }); }, [q.data]);
  const save = useAction(() => api(`/students/${student.id}/support-record/`, { method: "PUT", json: v }), { success: "Saved." });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorNote message="Only counselors and school admins can open support notes." />;
  return (
    <Card title="Confidential support notes">
      <p className="mb-4 rounded-md bg-chalk-soft px-3 py-2 text-sm">Restricted to counselors and school admins. Every view and edit is written to the audit log.</p>
      <div className="grid gap-4">
        <Field label="Medical notes" htmlFor="mn"><Textarea id="mn" rows={4} value={v.medical_notes} onChange={(e) => setV({ ...v, medical_notes: e.target.value })} /></Field>
        <Field label="Allergies" htmlFor="al"><Textarea id="al" value={v.allergies} onChange={(e) => setV({ ...v, allergies: e.target.value })} /></Field>
        <Field label="Support and counselling notes" htmlFor="sn"><Textarea id="sn" rows={4} value={v.support_notes} onChange={(e) => setV({ ...v, support_notes: e.target.value })} /></Field>
        <div><Button onClick={() => save.mutate(undefined)} loading={save.isPending}>Save notes</Button></div>
      </div>
    </Card>
  );
}
