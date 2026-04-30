import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/auth.store";

import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage }         from "./pages/auth/LoginPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";

// ── Lazy imports — cada módulo se carga solo al navegar ───────────────────────
const DashboardPage          = lazy(() => import("./pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const BranchDashboardPage    = lazy(() => import("./pages/dashboard/BranchDashboardPage").then((m) => ({ default: m.BranchDashboardPage })));
const AppointmentsPage       = lazy(() => import("./pages/appointments/AppointmentsPage").then((m) => ({ default: m.AppointmentsPage })));
const CalendarPage           = lazy(() => import("./pages/appointments/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const CustomersPage          = lazy(() => import("./pages/customers/CustomersPage").then((m) => ({ default: m.CustomersPage })));
const CustomerDetailPage     = lazy(() => import("./pages/customers/CustomerDetailPage").then((m) => ({ default: m.CustomerDetailPage })));
const SalesPage              = lazy(() => import("./pages/sales/SalesPage").then((m) => ({ default: m.SalesPage })));
const SaleDetailPage         = lazy(() => import("./pages/sales/SaleDetailPage").then((m) => ({ default: m.SaleDetailPage })));
const CashRegisterPage       = lazy(() => import("./pages/cash-register/CashRegisterPage").then((m) => ({ default: m.CashRegisterPage })));
const CashRegisterDetailPage = lazy(() => import("./pages/cash-register/CashRegisterDetailPage").then((m) => ({ default: m.CashRegisterDetailPage })));
const InventoryPage          = lazy(() => import("./pages/inventory/InventoryPage").then((m) => ({ default: m.InventoryPage })));
const ReportsPage            = lazy(() => import("./pages/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const ServicesPage           = lazy(() => import("./pages/services/ServicesPage").then((m) => ({ default: m.ServicesPage })));
const ProductsPage           = lazy(() => import("./pages/products/ProductsPage").then((m) => ({ default: m.ProductsPage })));
const UsersPage              = lazy(() => import("./pages/users/UsersPage").then((m) => ({ default: m.UsersPage })));
const SettingsPage           = lazy(() => import("./pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const UserDetailPage         = lazy(() => import("./pages/users/UserDetailPage").then((m) => ({ default: m.UserDetailPage })));
const ProfilePage            = lazy(() => import("./pages/users/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const BranchDetailPage       = lazy(() => import("./pages/branches/BranchDetailPage").then((m) => ({ default: m.BranchDetailPage })));
const PlansPage              = lazy(() => import("./pages/plans/PlansPage").then((m) => ({ default: m.PlansPage })));
const SubscriptionsPage      = lazy(() => import("./pages/subscriptions/SubscriptionsPage").then((m) => ({ default: m.SubscriptionsPage })));
const AuditPage              = lazy(() => import("./pages/audit/AuditPage").then((m) => ({ default: m.AuditPage })));
const IntegrationsPage       = lazy(() => import("./pages/integrations/IntegrationsPage").then((m) => ({ default: m.IntegrationsPage })));
const SuppliersPage          = lazy(() => import("./pages/suppliers/SuppliersPage").then((m) => ({ default: m.SuppliersPage })));

// ── Fallback de carga ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// ── Root dashboard selector ───────────────────────────────────────────────────
// Recepcionistas ven el Dashboard Sede; el resto ve el Dashboard general.
function RootDashboard() {
  const isReceptionist = useAuthStore(
    (s) => s.hasRole("RECEPTIONIST") && !s.hasAnyRole(["SUPER_ADMIN", "GENERAL_MANAGER", "BRANCH_MANAGER"]),
  );
  return (
    <Suspense fallback={<PageLoader />}>
      {isReceptionist ? <BranchDashboardPage /> : <DashboardPage />}
    </Suspense>
  );
}

// ── Guards ────────────────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      {/* Reset password — accesible siempre (el token es el guard real) */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected — dentro de AppLayout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Raíz: Dashboard general o Dashboard Sede según rol */}
        <Route index element={<RootDashboard />} />

        {/* Dashboard Sede — acceso directo (para bookmarks / links) */}
        <Route
          path="branch-dashboard"
          element={
            <Suspense fallback={<PageLoader />}>
              <BranchDashboardPage />
            </Suspense>
          }
        />
        <Route
          path="appointments"
          element={
            <Suspense fallback={<PageLoader />}>
              <AppointmentsPage />
            </Suspense>
          }
        />
        <Route
          path="calendar"
          element={
            <Suspense fallback={<PageLoader />}>
              <CalendarPage />
            </Suspense>
          }
        />
        <Route
          path="customers"
          element={
            <Suspense fallback={<PageLoader />}>
              <CustomersPage />
            </Suspense>
          }
        />
        <Route
          path="customers/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <CustomerDetailPage />
            </Suspense>
          }
        />
        <Route
          path="sales"
          element={
            <Suspense fallback={<PageLoader />}>
              <SalesPage />
            </Suspense>
          }
        />
        <Route
          path="sales/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <SaleDetailPage />
            </Suspense>
          }
        />
        <Route
          path="cash-register"
          element={
            <Suspense fallback={<PageLoader />}>
              <CashRegisterPage />
            </Suspense>
          }
        />
        <Route
          path="cash-register/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <CashRegisterDetailPage />
            </Suspense>
          }
        />
        <Route
          path="inventory"
          element={
            <Suspense fallback={<PageLoader />}>
              <InventoryPage />
            </Suspense>
          }
        />
        <Route
          path="reports"
          element={
            <Suspense fallback={<PageLoader />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="services"
          element={
            <Suspense fallback={<PageLoader />}>
              <ServicesPage />
            </Suspense>
          }
        />
        <Route
          path="products"
          element={
            <Suspense fallback={<PageLoader />}>
              <ProductsPage />
            </Suspense>
          }
        />
        <Route
          path="users"
          element={
            <Suspense fallback={<PageLoader />}>
              <UsersPage />
            </Suspense>
          }
        />
        <Route
          path="users/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <UserDetailPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <SettingsPage />
            </Suspense>
          }
        />
        <Route
          path="profile"
          element={
            <Suspense fallback={<PageLoader />}>
              <ProfilePage />
            </Suspense>
          }
        />
        <Route
          path="plans"
          element={
            <Suspense fallback={<PageLoader />}>
              <PlansPage />
            </Suspense>
          }
        />
        <Route
          path="subscriptions"
          element={
            <Suspense fallback={<PageLoader />}>
              <SubscriptionsPage />
            </Suspense>
          }
        />
        <Route
          path="audit"
          element={
            <Suspense fallback={<PageLoader />}>
              <AuditPage />
            </Suspense>
          }
        />
        <Route
          path="integrations"
          element={
            <Suspense fallback={<PageLoader />}>
              <IntegrationsPage />
            </Suspense>
          }
        />
        <Route
          path="suppliers"
          element={
            <Suspense fallback={<PageLoader />}>
              <SuppliersPage />
            </Suspense>
          }
        />
        <Route
          path="branches/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <BranchDetailPage />
            </Suspense>
          }
        />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
