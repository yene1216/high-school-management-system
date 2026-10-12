import type { School } from "../../api/types";
import { ResourceConfig, ResourceManager } from "../../components/crud/ResourceManager";
import { Badge } from "../../components/ui/Feedback";
import { PageHeader } from "../../components/ui/Layout";

export default function SchoolsPage() {
  const config: ResourceConfig<School> = {
    noun: "school", endpoint: "schools", search: true, canDelete: false,
    intro: "Every school on the platform. After creating one, add its first school administrator in the Django admin; they then set up everything else from School setup.",
    columns: [
      { key: "n", header: "School", cell: (s) => <span className="font-medium">{s.name}</span> },
      { key: "c", header: "Code", cell: (s) => <code className="text-xs">{s.code}</code> },
      { key: "cu", header: "Currency", cell: (s) => s.currency },
      { key: "a", header: "Status", cell: (s) => (s.is_active ? <Badge tone="good">Active</Badge> : <Badge tone="bad">Inactive</Badge>) },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, wide: true },
      { name: "code", label: "Short code", type: "text", required: true, hint: "Letters and numbers; used in student IDs and invoice numbers. Don't change it later." },
      { name: "currency", label: "Currency", type: "text", defaultValue: "ETB", hint: "3-letter code" },
      { name: "phone", label: "Phone", type: "text" }, { name: "email", label: "Email", type: "email" },
      { name: "address", label: "Address", type: "text", wide: true },
      { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
    ],
  };
  return (<><PageHeader title="Schools" /><ResourceManager config={config} /></>);
}
