import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/AppLayout";
import { lazy, Suspense, ReactNode } from "react";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const POSBilling = lazy(() => import("./pages/POSBilling"));
const Customers = lazy(() => import("./pages/Customers"));
const Services = lazy(() => import("./pages/Services"));
const Packages = lazy(() => import("./pages/Packages"));
const Discounts = lazy(() => import("./pages/Discounts"));
const Employees = lazy(() => import("./pages/Employees"));
const Reports = lazy(() => import("./pages/Reports"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Expenses = lazy(() => import("./pages/Expenses"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
        <LoginPage />
      </Suspense>
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
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
          <Route path="/expenses" element={<ProtectedRoute path="/expenses"><Expenses /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute path="/settings"><SettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
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
