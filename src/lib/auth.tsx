import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
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
import { joinSharedDemo, syncSharedDemo } from "./demo-sharing";
import { toast } from "sonner";

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
  const authVersion = useRef(0);

  useEffect(() => {
    const version = authVersion.current;
    let cancelled = false;
    const stale = () => cancelled || version !== authVersion.current;
    (async () => {
      const savedDemoRole = demoRole();
      if (savedDemoRole) {
        try {
          await joinSharedDemo(savedDemoRole, true);
        } catch (error) {
          if (stale()) return;
          toast.error(error instanceof Error ? error.message : "Could not load shared demo");
          setLoading(false);
          return;
        }
        if (stale()) return;
        setUser(demoProfile(savedDemoRole));
        setIsDemo(true);
        setLoading(false);
        return;
      }
      try {
        // Real (owner/admin) session takes priority
        const session = await getCurrentSession();
        if (stale()) return;
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
      if (stale()) return;
      try {
        // Real tenant session comes next
        const tenantSession = await getCurrentTenantSession();
        if (stale()) return;
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
      if (stale()) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDemo) return;
    const timer = window.setInterval(() => {
      syncSharedDemo()
        .then(() => {
          const role = demoRole();
          if (role) setUser(demoProfile(role));
          void queryClient.invalidateQueries();
        })
        .catch(() => {});
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [isDemo, queryClient]);

  useEffect(() => {
    const refresh = () => {
      const role = demoRole();
      if (role) setUser(demoProfile(role));
    };
    window.addEventListener("demo-synced", refresh);
    return () => window.removeEventListener("demo-synced", refresh);
  }, []);

  const loginReal = async (email: string, password: string) => {
    authVersion.current++;
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
    setLoading(false);
  };

  const signupReal = async (name: string, email: string, password: string, phone?: string) => {
    authVersion.current++;
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
    setLoading(false);
  };

  const loginTenantReal = async (email: string, phone: string) => {
    authVersion.current++;
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
    setLoading(false);
  };

  const loginAs = async (role: Role) => {
    const version = ++authVersion.current;
    // No network is required for a local demo or a previously loaded workspace.
    // New share links must load their records before we commit the selected role.
    try {
      await joinSharedDemo(role, true);
    } catch (error) {
      if (version === authVersion.current) setLoading(false);
      throw error;
    }
    if (version !== authVersion.current) return;
    queryClient.clear();
    localStorage.setItem(KEY, JSON.stringify({ role }));
    flushSync(() => {
      setIsDemo(true);
      setUser(demoProfile(role));
      setLoading(false);
    });
  };
  const logout = async () => {
    authVersion.current++;
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
    authVersion.current++;
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
