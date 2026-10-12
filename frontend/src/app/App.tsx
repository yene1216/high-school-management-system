import { lazy, ReactNode, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import type { Role } from "../api/types";
import { ADMIN, ATTENDANCE_TAKERS, FAMILY, FINANCE, GRADERS, MANAGEMENT, REGISTRY, STAFF } from "../auth/roles";
import { Spinner } from "../components/ui/Feedback";
import AppShell from "./AppShell";
import { RequireAuth, RequireRole } from "./guards";

const Login = lazy(() => import("../features/account/LoginPage"));
const ResetPassword = lazy(() => import("../features/account/ResetPasswordPage"));
const Settings = lazy(() => import("../features/account/SettingsPage"));
const Notifications = lazy(() => import("../features/communication/NotificationsPage"));
const Announcements = lazy(() => import("../features/communication/AnnouncementsPage"));
const Dashboard = lazy(() => import("../features/dashboard/DashboardPage"));
const Students = lazy(() => import("../features/students/StudentsPage"));
const StudentDetail = lazy(() => import("../features/students/StudentDetailPage"));
const Guardians = lazy(() => import("../features/people/GuardiansPage"));
const Enrollments = lazy(() => import("../features/people/EnrollmentsPage"));
const Attendance = lazy(() => import("../features/attendance/AttendancePage"));
const Corrections = lazy(() => import("../features/attendance/CorrectionsPage"));
const Gradebook = lazy(() => import("../features/grading/GradebookPage"));
const AssessmentDetail = lazy(() => import("../features/grading/AssessmentPage"));
const Invoices = lazy(() => import("../features/finance/InvoicesPage"));
const InvoiceDetail = lazy(() => import("../features/finance/InvoiceDetailPage"));
const Payments = lazy(() => import("../features/finance/PaymentsPage"));
const Receipt = lazy(() => import("../features/finance/ReceiptPage"));
const Refunds = lazy(() => import("../features/finance/RefundsPage"));
const Reports = lazy(() => import("../features/reports/ReportsPage"));
const Audit = lazy(() => import("../features/admin/AuditPage"));
const Deliveries = lazy(() => import("../features/admin/DeliveriesPage"));
const Setup = lazy(() => import("../features/admin/SetupPage"));
const Users = lazy(() => import("../features/admin/UsersPage"));
const Schools = lazy(() => import("../features/admin/SchoolsPage"));

const guard = (roles: Role[], el: ReactNode) => <RequireRole roles={roles}>{el}</RequireRole>;
const ALL: Role[] = [...STAFF, ...FAMILY];

function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That address doesn't exist.</p>
      <Link to="/" className="btn btn-primary mt-4">Back to the dashboard</Link>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="p-8"><Spinner /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="students" element={guard([...STAFF, ...FAMILY], <Students />)} />
            <Route path="students/:id" element={guard([...STAFF, ...FAMILY], <StudentDetail />)} />
            <Route path="guardians" element={guard([...REGISTRY, "principal"], <Guardians />)} />
            <Route path="enrollments" element={guard([...REGISTRY, "principal"], <Enrollments />)} />
            <Route path="attendance" element={guard(ATTENDANCE_TAKERS, <Attendance />)} />
            <Route path="corrections" element={guard(["school_admin", "principal", "registrar", "teacher"], <Corrections />)} />
            <Route path="gradebook" element={guard(GRADERS, <Gradebook />)} />
            <Route path="gradebook/:id" element={guard(GRADERS, <AssessmentDetail />)} />
            <Route path="invoices" element={guard([...FINANCE, ...FAMILY], <Invoices />)} />
            <Route path="invoices/:id" element={guard([...FINANCE, ...FAMILY], <InvoiceDetail />)} />
            <Route path="payments" element={guard([...FINANCE, ...FAMILY], <Payments />)} />
            <Route path="payments/:id/receipt" element={guard([...FINANCE, ...FAMILY], <Receipt />)} />
            <Route path="refunds" element={guard(FINANCE, <Refunds />)} />
            <Route path="announcements" element={guard(ALL, <Announcements />)} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="reports" element={guard([...MANAGEMENT, "registrar", "accountant", "teacher"], <Reports />)} />
            <Route path="audit" element={guard([...MANAGEMENT, "super_admin"], <Audit />)} />
            <Route path="deliveries" element={guard(MANAGEMENT, <Deliveries />)} />
            <Route path="setup" element={guard(ADMIN, <Setup />)} />
            <Route path="users" element={guard([...ADMIN, "super_admin"], <Users />)} />
            <Route path="schools" element={guard(["super_admin"], <Schools />)} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
