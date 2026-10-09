import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RoleSelect from './pages/RoleSelect'
import CustomerApp from './pages/customer/CustomerApp'
import MenuPreview from './pages/customer/MenuPreview'
import UnlockTable from './pages/customer/UnlockTable'
import TableMap from './pages/waiter/TableMap'
import TableDetail from './pages/waiter/TableDetail'
import KitchenBoard from './pages/kitchen/KitchenBoard'
import LoginPage from './pages/LoginPage'
import AdminProductList from './pages/admin/AdminProductList'
import AdminProductForm from './pages/admin/AdminProductForm'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import AdminStaff from './pages/admin/AdminStaff'
import SuperAdminLogin from './pages/superadmin/SuperAdminLogin'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import ConnectionBanner from './components/ConnectionBanner'
import ToastHost from './components/ToastHost'
import RequireAuth from './components/RequireAuth'
import RequireSuperAdmin from './components/RequireSuperAdmin'
import TenantGate from './components/TenantGate'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Platform-level area: not scoped to any one client's subdomain. */}
        <Route path="/super-admin/login" element={<SuperAdminLogin />} />
        <Route
          path="/super-admin"
          element={
            <RequireSuperAdmin>
              <SuperAdminDashboard />
            </RequireSuperAdmin>
          }
        />

        {/* Everything else belongs to whichever client this subdomain resolves to. */}
        <Route
          path="*"
          element={
            <TenantGate>
              <ConnectionBanner />
              <ToastHost />
              <Routes>
                <Route path="/" element={<RoleSelect />} />
                <Route path="/mesa/:tableId" element={<CustomerApp />} />
                <Route path="/cardapio" element={<MenuPreview />} />
                <Route path="/liberar-mesa" element={<UnlockTable />} />
                <Route
                  path="/garcom"
                  element={
                    <RequireAuth roles={['garcom']}>
                      <TableMap />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/garcom/:tableId"
                  element={
                    <RequireAuth roles={['garcom']}>
                      <TableDetail />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/cozinha"
                  element={
                    <RequireAuth roles={['cozinha']}>
                      <KitchenBoard />
                    </RequireAuth>
                  }
                />
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth roles={['admin']}>
                      <AdminProductList />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin/novo"
                  element={
                    <RequireAuth roles={['admin']}>
                      <AdminProductForm />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin/:id/editar"
                  element={
                    <RequireAuth roles={['admin']}>
                      <AdminProductForm />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin/analytics"
                  element={
                    <RequireAuth roles={['admin']}>
                      <AdminAnalytics />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin/equipe"
                  element={
                    <RequireAuth roles={['admin']}>
                      <AdminStaff />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </TenantGate>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
