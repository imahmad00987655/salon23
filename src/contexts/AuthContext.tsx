import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getApiOrigin } from "@/lib/apiBase";

export type UserRole = "admin" | "super_admin" | "manager" | "cashier";

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

const AUTH_API_BASE = `${getApiOrigin()}/auth.php`;

// Permission map per role
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ["/", "/pos", "/customers", "/services", "/packages", "/discounts", "/employees", "/reports", "/invoices", "/expenses", "/customer-balances", "/settings"],
  super_admin: ["/", "/pos", "/customers", "/services", "/packages", "/discounts", "/employees", "/reports", "/invoices", "/expenses", "/customer-balances", "/settings"],
  manager: ["/", "/pos", "/customers", "/services", "/packages", "/discounts", "/employees", "/reports", "/invoices", "/expenses", "/customer-balances"],
  cashier: ["/pos", "/customers", "/discounts", "/reports", "/expenses", "/customer-balances"],
};

interface AuthContextType {
  isAuthenticated: boolean;
  user: AppUser | null;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  hasAccess: (path: string) => boolean;
  setUserFromSettings?: (u: { id: number; name: string; email: string; role: string }) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem("salon-spark:user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      window.localStorage.setItem("salon-spark:user", JSON.stringify(user));
    } else {
      window.localStorage.removeItem("salon-spark:user");
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(AUTH_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return (data && typeof data.error === "string") ? data.error : "Invalid email or password";
      }
      const u = data.user;
      if (!u || typeof u !== "object") {
        return "Invalid response from server";
      }
      setUser({
        id: String(u.id ?? ""),
        name: (u.name ?? "") as string,
        email: (u.email ?? "") as string,
        role: (u.role ?? "cashier") as UserRole,
      });
      return null;
    } catch {
      return "Login failed. Check connection.";
    }
  };

  const logout = () => {
    setUser(null);
  };

  const hasAccess = (path: string) => {
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role].includes(path);
  };

  const setUserFromSettings = (u: { id: number; name: string; email: string; role: string }) => {
    setUser({
      id: String(u.id),
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
    });
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout, hasAccess, setUserFromSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
