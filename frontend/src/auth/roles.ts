import type { Role, User } from "../api/types";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Platform admin", school_admin: "School admin", registrar: "Registrar", teacher: "Teacher",
  parent: "Parent / guardian", student: "Student", accountant: "Accountant / cashier", hr: "HR",
  principal: "Principal", librarian: "Librarian", transport: "Transport manager", counselor: "Counselor / nurse",
};
export const ASSIGNABLE_ROLES: Role[] = ["school_admin", "registrar", "teacher", "parent", "student", "accountant", "principal", "hr", "librarian", "transport", "counselor"];

// These mirror the backend's permission groups (apps/core/permissions.py).
export const ADMIN: Role[] = ["school_admin"];
export const MANAGEMENT: Role[] = ["school_admin", "principal"];
export const REGISTRY: Role[] = ["school_admin", "registrar"];
export const FINANCE: Role[] = ["school_admin", "accountant", "principal"];
export const CASHIERS: Role[] = ["school_admin", "accountant"];
export const GRADERS: Role[] = ["school_admin", "principal", "teacher"];
export const ATTENDANCE_TAKERS: Role[] = ["school_admin", "registrar", "teacher"];
export const STAFF: Role[] = ["school_admin", "registrar", "teacher", "accountant", "hr", "principal", "librarian", "transport", "counselor"];
export const FAMILY: Role[] = ["parent", "student"];

export const isIn = (user: User | null | undefined, roles: Role[]) => !!user && roles.includes(user.role);
