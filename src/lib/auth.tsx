import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEMO_USERS, type DemoUser, type Role } from "./demo-data";
import { getCurrentSession, login as loginFn, signup as signupFn, logout as logoutFn } from "./api/functions/auth-fns";
import { getCurrentTenantSession, loginTenant as loginTenantFn, logoutTenant as logoutTenantFn } from "./api/functions/tenant-fns";

const KEY = "pgone.session.v1";

type AuthCtx = {
  user: DemoUser | null;
  loading: boolean;
  // Real owner/admin auth, backed by the database
  loginReal: (email: string, password: string) => Promise<void>;
  signupReal: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  // Real tenant auth, backed by the database (matches email + phone on an existing booking)
  loginTenantReal: (email: string, phone: string) => Promise<void>;
  // Demo auth for staff previews (not yet backed by real data — see roadmap)
  loginAs: (role: Role) => void;
  logout: () => Promise<void>;
  setRole: (role: Role) => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  loginReal: async () => {},
  signupReal: async () => {},
  loginTenantReal: async () => {},
  loginAs: () => {},
  logout: async () => {},
  setRole: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Real (owner/admin) session takes priority
        const session = await getCurrentSession();
        if (session) {
          setUser({ ...DEMO_USERS.admin, id: session.ownerId, name: session.name, email: session.email });
          setLoading(false);
          return;
        }
      } catch {
        /* not logged in via real auth */
      }
      try {
        // Real tenant session comes next
        const tenantSession = await getCurrentTenantSession();
        if (tenantSession) {
          setUser({ ...DEMO_USERS.tenant, id: tenantSession.id, name: tenantSession.name, email: tenantSession.email });
          setLoading(false);
          return;
        }
      } catch {
        /* not logged in via real tenant auth */
      }
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
        if (raw) {
          const parsed = JSON.parse(raw) as { role: Role };
          setUser(DEMO_USERS[parsed.role]);
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, []);

  const loginReal = async (email: string, password: string) => {
    const owner = await loginFn({ data: { email, password } });
    setUser({ ...DEMO_USERS.admin, id: owner.id, name: owner.name, email: owner.email });
  };

  const signupReal = async (name: string, email: string, password: string, phone?: string) => {
    const owner = await signupFn({ data: { name, email, password, phone } });
    setUser({ ...DEMO_USERS.admin, id: owner.id, name: owner.name, email: owner.email });
  };

  const loginTenantReal = async (email: string, phone: string) => {
    const tenant = await loginTenantFn({ data: { email, phone } });
    setUser({ ...DEMO_USERS.tenant, id: tenant.id, name: tenant.name, email: tenant.email });
  };

  const loginAs = (role: Role) => {
    localStorage.setItem(KEY, JSON.stringify({ role }));
    setUser(DEMO_USERS[role]);
  };
  const logout = async () => {
    localStorage.removeItem(KEY);
    try {
      await logoutFn();
    } catch {
      /* ignore */
    }
    try {
      await logoutTenantFn();
    } catch {
      /* ignore */
    }
    setUser(null);
  };
  const setRole = (role: Role) => loginAs(role);

  return (
    <Ctx.Provider
      value={{ user, loading, loginReal, signupReal, loginTenantReal, loginAs, logout, setRole }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
