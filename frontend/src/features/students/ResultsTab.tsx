import { useState } from "react";
import { useItem, useLookup } from "../../api/hooks";
import type { GradeRow, ReportCard, Student, Term } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, Spinner } from "../../components/ui/Feedback";
import { Select } from "../../components/ui/Form";
import { Card } from "../../components/ui/Layout";
import { fmtDate, num } from "../../lib/format";

function ReportCardView({ student }: { student: Student }) {
  const [term, setTerm] = useState("");
  const terms = useLookup<Term>("terms");
  const rc = useItem<ReportCard>("/report-cards/", { student: student.id, term: term || undefined });
  return (
    <Card title="Report card" actions={<span className="no-print flex items-center gap-2">
      <Select aria-label="Term" className="w-44" value={term} onChange={(e) => setTerm(e.target.value)}><option value="">All terms</option>{terms.rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
      <Button variant="secondary" small onClick={() => window.print()}>Print / Save as PDF</Button></span>} className="print-sheet">
      {rc.isLoading ? <Spinner /> : rc.isError ? <ErrorNote message="Couldn't load the report card." /> : !rc.data || rc.data.subjects.length === 0 ? (
        <p className="text-sm text-muted">No published results to summarise yet.</p>
      ) : (
        <div>
          <p className="mb-3 hidden text-lg font-semibold print:block">{rc.data.student.name} · {rc.data.student.code}</p>
          <table className="w-full">
            <thead className="border-b border-line"><tr><th className="th">Subject</th><th className="th text-right">Average</th><th className="th text-right">Grade</th></tr></thead>
            <tbody>
              {rc.data.subjects.map((s) => <tr key={s.subject} className="border-b border-line"><td className="td">{s.subject}</td><td className="td text-right">{num(s.percent).toFixed(1)}%</td><td className="td text-right font-semibold">{s.letter}</td></tr>)}
              <tr className="bg-paper/60"><td className="td font-semibold">Overall</td><td className="td text-right font-semibold">{num(rc.data.overall_percent).toFixed(1)}%</td><td className="td text-right font-display text-lg font-semibold">{rc.data.overall_letter}</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">Weighted average of published assessments only.</p>
        </div>
      )}
    </Card>
  );
}

export function ResultsTab({ student }: { student: Student }) {
  const q = useItem<GradeRow[]>(`/students/${student.id}/grades/`);
  return (
    <div className="space-y-5">
      <ReportCardView student={student} />
      <Card title="All results" flush className="no-print">
        {q.isLoading ? <div className="p-5"><Spinner /></div> : !q.data?.length ? <div className="p-5"><EmptyState title="No published results yet" /></div> : (
          <table className="w-full">
            <thead className="border-b border-line"><tr><th className="th">Subject</th><th className="th">Assessment</th><th className="th">Date</th><th className="th text-right">Score</th></tr></thead>
            <tbody>
              {q.data.map((g) => (
                <tr key={g.id} className="border-b border-line last:border-0">
                  <td className="td">{g.subject}</td><td className="td">{g.assessment_name}{g.remarks && <span className="block text-xs text-muted">{g.remarks}</span>}</td><td className="td text-muted">{fmtDate(g.date)}</td>
                  <td className="td text-right font-medium">{g.score === null ? "—" : `${num(g.score)} / ${num(g.max_score)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
