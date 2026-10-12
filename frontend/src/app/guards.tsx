import { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Spinner } from "../components/ui/Feedback";

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8"><Spinner /></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-semibold">You don't have access to this page</h1>
        <p className="mt-2 text-sm text-muted">Your role can't open it. If you think that's a mistake, ask your school administrator.</p>
      </div>
    );
  }
  return <>{children}</>;
}
