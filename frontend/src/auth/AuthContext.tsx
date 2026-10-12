import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, refreshAccess, serverLogout, setAccessToken, setSessionExpiredHandler } from "../api/client";
import type { User } from "../api/types";
import { useI18n } from "../i18n";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  const { setLang } = useI18n();

  const adopt = useCallback((u: User) => { setUser(u); if (u.language) setLang(u.language); }, [setLang]);

  useEffect(() => {
    setSessionExpiredHandler(() => { setUser(null); qc.clear(); });
    (async () => {
      if (await refreshAccess()) {
        try { adopt(await api<User>("/auth/me/")); } catch { setAccessToken(null); }
      }
      setLoading(false);
    })();
    return () => setSessionExpiredHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ access: string; user: User }>("/auth/login/", { method: "POST", json: { email, password }, anonymous: true });
    setAccessToken(res.access);
    qc.clear();
    adopt(res.user);
  }, [adopt, qc]);

  const logout = useCallback(async () => {
    await serverLogout();
    setUser(null);
    qc.clear(); // never leave one user's data cached for the next person on a shared computer
  }, [qc]);

  const reloadUser = useCallback(async () => { adopt(await api<User>("/auth/me/")); }, [adopt]);

  const value = useMemo(() => ({ user, loading, login, logout, reloadUser }), [user, loading, login, logout, reloadUser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** The signed-in user; only call inside routes that require sign-in. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("No signed-in user");
  return user;
}
