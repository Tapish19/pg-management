import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DEMO_USERS, type DemoUser, type Role } from "./demo-data";
import {
  getCurrentSession,
  login as loginFn,
  signup as signupFn,
  logout as logoutFn,
} from "./api/functions/auth-fns";
import {
  getCurrentTenantSession,
  loginTenant as loginTenantFn,
  logoutTenant as logoutTenantFn,
} from "./api/functions/tenant-fns";
import { saveProfile } from "./demo-api";
import { demoRole, demoProfile } from "./demo-store";

const KEY = "pgone.session.v1";

type AuthCtx = {
  user: DemoUser | null;
  loading: boolean;
  isDemo: boolean;
  updateProfile: (details: { name: string; email: string; phone: string }) => Promise<void>;
  // Real owner/admin auth, backed by the database
  loginReal: (email: string, password: string) => Promise<void>;
  signupReal: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  // Real tenant auth, backed by the database (matches email + phone on an existing booking)
  loginTenantReal: (email: string, phone: string) => Promise<void>;
  // Demo auth for staff previews (not yet backed by real data — see roadmap)
  loginAs: (role: Role) => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: Role) => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  isDemo: false,
  updateProfile: async () => {},
  loginReal: async () => {},
  signupReal: async () => {},
  loginTenantReal: async () => {},
  loginAs: async () => {},
  logout: async () => {},
  setRole: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isDemo, setIsDemo] = useState(false);
  const [user, setUser] = useState<DemoUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const savedDemoRole = demoRole();
      if (savedDemoRole) {
        setUser(demoProfile(savedDemoRole));
        setIsDemo(true);
        setLoading(false);
        return;
      }
      try {
        // Real (owner/admin) session takes priority
        const session = await getCurrentSession();
        if (demoRole()) return;
        if (session) {
          setUser({
            ...DEMO_USERS.admin,
            id: session.ownerId,
            name: session.name,
            email: session.email,
            phone: session.phone ?? "",
          });
          setLoading(false);
          return;
        }
      } catch {
        /* not logged in via real auth */
      }
      try {
        // Real tenant session comes next
        const tenantSession = await getCurrentTenantSession();
        if (demoRole()) return;
        if (tenantSession) {
          setUser({
            ...DEMO_USERS.tenant,
            id: tenantSession.id,
            name: tenantSession.name,
            email: tenantSession.email,
            phone: tenantSession.phone,
          });
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
          setUser(demoProfile(parsed.role));
          setIsDemo(true);
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, []);

  const loginReal = async (email: string, password: string) => {
    const owner = await loginFn({ data: { email, password } });
    queryClient.clear();
    localStorage.removeItem(KEY);
    setIsDemo(false);
    setUser({
      ...DEMO_USERS.admin,
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone ?? "",
    });
  };

  const signupReal = async (name: string, email: string, password: string, phone?: string) => {
    const owner = await signupFn({ data: { name, email, password, phone } });
    queryClient.clear();
    localStorage.removeItem(KEY);
    setIsDemo(false);
    setUser({
      ...DEMO_USERS.admin,
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone ?? "",
    });
  };

  const loginTenantReal = async (email: string, phone: string) => {
    const tenant = await loginTenantFn({ data: { email, phone } });
    queryClient.clear();
    localStorage.removeItem(KEY);
    setIsDemo(false);
    setUser({
      ...DEMO_USERS.tenant,
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
    });
  };

  const loginAs = async (role: Role) => {
    queryClient.clear();
    setIsDemo(true);
    localStorage.setItem(KEY, JSON.stringify({ role }));
    setUser(demoProfile(role));
    setLoading(false);
  };
  const logout = async () => {
    localStorage.removeItem(KEY);
    if (isDemo) {
      setUser(null);
      setIsDemo(false);
      queryClient.clear();
      return;
    }
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
    setIsDemo(false);
    queryClient.clear();
  };
  const setRole = (role: Role) => {
    if (!isDemo) return;
    queryClient.clear();
    localStorage.setItem(KEY, JSON.stringify({ role }));
    setUser(demoProfile(role));
  };

  const updateProfile = async (details: { name: string; email: string; phone: string }) => {
    const saved = await saveProfile({ data: details });
    setUser((current) => (current ? { ...current, ...saved } : current));
    await queryClient.invalidateQueries();
  };

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        isDemo,
        updateProfile,
        loginReal,
        signupReal,
        loginTenantReal,
        loginAs,
        logout,
        setRole,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
