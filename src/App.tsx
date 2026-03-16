import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import POSBilling from "./pages/POSBilling";
import Customers from "./pages/Customers";
import Services from "./pages/Services";
import Packages from "./pages/Packages";
import Discounts from "./pages/Discounts";
import Employees from "./pages/Employees";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/SettingsPage";
import Invoices from "./pages/Invoices";
import NotFound from "./pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ path, children }: { path: string; children: ReactNode }) {
  const { hasAccess } = useAuth();
  if (!hasAccess(path)) {
    // Redirect to first accessible route
    return <Navigate to="/pos" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <LoginPage />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ProtectedRoute path="/"><Dashboard /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute path="/pos"><POSBilling /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute path="/customers"><Customers /></ProtectedRoute>} />
        <Route path="/services" element={<ProtectedRoute path="/services"><Services /></ProtectedRoute>} />
        <Route path="/packages" element={<ProtectedRoute path="/packages"><Packages /></ProtectedRoute>} />
        <Route path="/discounts" element={<ProtectedRoute path="/discounts"><Discounts /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute path="/employees"><Employees /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute path="/reports"><Reports /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute path="/invoices"><Invoices /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute path="/settings"><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
