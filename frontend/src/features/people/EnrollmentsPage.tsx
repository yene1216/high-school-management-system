import { useState } from "react";
import { Link } from "react-router-dom";
import type { AcademicYear, Enrollment, Section } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { REGISTRY } from "../../auth/roles";
import { ResourceConfig, ResourceManager } from "../../components/crud/ResourceManager";
import { RemoteSelect } from "../../components/domain/Pickers";
import { StatusBadge } from "../../components/ui/Feedback";
import { Select } from "../../components/ui/Form";
import { PageHeader } from "../../components/ui/Layout";
import { fmtDate } from "../../lib/format";

export default function EnrollmentsPage() {
  const user = useUser();
  const canWrite = REGISTRY.includes(user.role);
  const [section, setSection] = useState("");
  const [status, setStatus] = useState("active");
  const [year, setYear] = useState("");

  const config: ResourceConfig<Enrollment> = {
    noun: "enrollment", endpoint: "enrollments", canCreate: canWrite, canEdit: canWrite, canDelete: false,
    params: { section: section || undefined, status: status || undefined, academic_year: year || undefined },
    intro: "Which class each student is in this year. To move a student, set the old enrollment to “completed” and add a new one — or use “Change class” on the student's page.",
    columns: [
      { key: "s", header: "Student", cell: (e) => <Link className="font-medium hover:underline" to={`/students/${e.student}`}>{e.student_name}</Link> },
      { key: "c", header: "Class", cell: (e) => e.section_label },
      { key: "st", header: "Status", cell: (e) => <StatusBadge status={e.status} /> },
      { key: "d", header: "Enrolled", cell: (e) => fmtDate(e.enrolled_on) },
    ],
    fields: [
      { name: "student", label: "Student", type: "student", required: true, createOnly: true, wide: true },
      { name: "section", label: "Class", type: "select", required: true, wide: true, remote: { endpoint: "sections", text: (s: Section) => `${s.label} (${s.student_count}/${s.capacity})` } },
      { name: "status", label: "Status", type: "select", editOnly: true, required: true, options: [{ value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "promoted", label: "Promoted" }, { value: "withdrawn", label: "Withdrawn" }] },
    ],
    toolbar: (
      <>
        <div className="w-40"><RemoteSelect endpoint="sections" value={section} onChange={setSection} text={(s: Section) => s.label} placeholder="Any class" /></div>
        <div className="w-36"><RemoteSelect endpoint="academic-years" value={year} onChange={setYear} text={(y: AcademicYear) => y.name} placeholder="Any year" /></div>
        <Select className="w-36" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option><option value="active">Active</option><option value="completed">Completed</option><option value="promoted">Promoted</option><option value="withdrawn">Withdrawn</option>
        </Select>
      </>
    ),
  };
  return (<><PageHeader title="Enrollments" /><ResourceManager config={config} /></>);
}
