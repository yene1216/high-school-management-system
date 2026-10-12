import type { Role, User } from "../api/types";
import { ADMIN, ATTENDANCE_TAKERS, FAMILY, FINANCE, GRADERS, MANAGEMENT, REGISTRY, STAFF } from "../auth/roles";

export interface NavItem { to: string; key: string; label: string; roles: Role[]; familyLabel?: { key: string; label: string } }
export interface NavGroup { key: string; label: string; items: NavItem[] }

const ALL: Role[] = [...STAFF, ...FAMILY];

export const NAV: NavGroup[] = [
  { key: "group.overview", label: "Overview", items: [
    { to: "/", key: "nav.dashboard", label: "Dashboard", roles: [...ALL, "super_admin"] },
  ] },
  { key: "group.people", label: "People", items: [
    { to: "/students", key: "nav.students", label: "Students", roles: [...STAFF, ...FAMILY], familyLabel: { key: "nav.myChildren", label: "My children" } },
    { to: "/guardians", key: "nav.guardians", label: "Guardians", roles: [...REGISTRY, "principal"] },
    { to: "/enrollments", key: "nav.enrollments", label: "Enrollments", roles: [...REGISTRY, "principal"] },
  ] },
  { key: "group.teaching", label: "Teaching", items: [
    { to: "/attendance", key: "nav.attendance", label: "Attendance", roles: ATTENDANCE_TAKERS },
    { to: "/gradebook", key: "nav.gradebook", label: "Gradebook", roles: GRADERS },
    { to: "/corrections", key: "nav.corrections", label: "Corrections", roles: ["school_admin", "principal", "registrar", "teacher"] },
  ] },
  { key: "group.finance", label: "Finance", items: [
    { to: "/invoices", key: "nav.invoices", label: "Invoices", roles: [...FINANCE, ...FAMILY] },
    { to: "/payments", key: "nav.payments", label: "Payments", roles: [...FINANCE, ...FAMILY] },
    { to: "/refunds", key: "nav.refunds", label: "Refunds", roles: FINANCE },
  ] },
  { key: "group.communication", label: "Communication", items: [
    { to: "/announcements", key: "nav.announcements", label: "Announcements", roles: ALL },
    { to: "/notifications", key: "nav.notifications", label: "Notifications", roles: [...ALL, "super_admin"] },
  ] },
  { key: "group.insights", label: "Insights", items: [
    { to: "/reports", key: "nav.reports", label: "Reports", roles: [...MANAGEMENT, "registrar", "accountant", "teacher"] },
    { to: "/audit", key: "nav.audit", label: "Audit log", roles: [...MANAGEMENT, "super_admin"] },
    { to: "/deliveries", key: "nav.deliveries", label: "Message delivery", roles: MANAGEMENT },
  ] },
  { key: "group.administration", label: "Administration", items: [
    { to: "/setup", key: "nav.setup", label: "School setup", roles: ADMIN },
    { to: "/users", key: "nav.users", label: "Users", roles: [...ADMIN, "super_admin"] },
    { to: "/schools", key: "nav.schools", label: "Schools", roles: ["super_admin"] },
  ] },
];

export function visibleNav(user: User): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(user.role)) })).filter((g) => g.items.length > 0);
}
