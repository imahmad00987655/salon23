import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Users, Scissors, Gift, Percent,
  UserCog, BarChart3, Settings, Moon, Sun, LogOut, ChevronLeft, FileText, ReceiptText,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "POS Billing", icon: ShoppingCart, path: "/pos" },
  { label: "Customers", icon: Users, path: "/customers" },
  { label: "Services", icon: Scissors, path: "/services" },
  { label: "Packages", icon: Gift, path: "/packages" },
  { label: "Discounts", icon: Percent, path: "/discounts" },
  { label: "Employees", icon: UserCog, path: "/employees" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Invoices", icon: FileText, path: "/invoices" },
  { label: "Expenses", icon: ReceiptText, path: "/expenses" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

type AppSidebarProps = { variant?: "sidebar" | "drawer" };

export function AppSidebar({ variant = "sidebar" }: AppSidebarProps) {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { user, logout, hasAccess } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const isDrawer = variant === "drawer";

  const visibleItems = navItems.filter(item => hasAccess(item.path));

  const content = (
    <>
      {!isDrawer && (
        <div className="h-14 sm:h-16 flex items-center px-3 sm:px-4 border-b border-sidebar-border shrink-0">
          {!collapsed && <span className="font-heading font-bold text-base sm:text-lg text-foreground tracking-tight">Sheeza Saloon</span>}
          <button onClick={() => setCollapsed(!collapsed)} className={cn("p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground transition-colors touch-manipulation", collapsed ? "mx-auto" : "ml-auto")}>
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>
      )}
      {isDrawer && (
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border shrink-0">
          <span className="font-heading font-bold text-lg text-foreground tracking-tight">Sheeza Saloon</span>
        </div>
      )}

      <nav className="flex-1 py-4 px-2 sm:px-3 space-y-0.5 overflow-y-auto overflow-x-hidden min-h-0">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={cn("flex items-center gap-3 px-3 py-2.5 sm:py-3 rounded-md text-sm font-medium transition-colors touch-manipulation", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", isDrawer && "py-3")}>
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span>{isDrawer || !collapsed ? item.label : null}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2 shrink-0">
        <button type="button" onClick={toggle} className="flex items-center gap-3 w-full px-3 py-2.5 sm:py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors touch-manipulation">
          {theme === "light" ? <Moon className="h-4 w-4 shrink-0" /> : <Sun className="h-4 w-4 shrink-0" />}
          <span>{isDrawer || !collapsed ? (theme === "light" ? "Dark Mode" : "Light Mode") : null}</span>
        </button>
        {user && (isDrawer || !collapsed) && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
              {user.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role.replace("_", " ")}</p>
            </div>
            <button type="button" onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors p-1 touch-manipulation">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );

  if (isDrawer) {
    return <div className="flex flex-col h-full bg-sidebar">{content}</div>;
  }

  return (
    <aside
      className={cn(
        "hidden md:flex h-screen sticky top-0 flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 z-30",
        collapsed ? "w-14 sm:w-16" : "w-56 sm:w-60"
      )}
    >
      {content}
    </aside>
  );
}
