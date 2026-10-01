import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RoleSelect from './pages/RoleSelect'
import CustomerApp from './pages/customer/CustomerApp'
import TableMap from './pages/waiter/TableMap'
import TableDetail from './pages/waiter/TableDetail'
import KitchenBoard from './pages/kitchen/KitchenBoard'
import LoginPage from './pages/LoginPage'
import AdminProductList from './pages/admin/AdminProductList'
import AdminProductForm from './pages/admin/AdminProductForm'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import ConnectionBanner from './components/ConnectionBanner'
import ToastHost from './components/ToastHost'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <ConnectionBanner />
      <ToastHost />
      <Routes>
        <Route path="/" element={<RoleSelect />} />
        <Route path="/mesa/:tableId" element={<CustomerApp />} />
        <Route path="/garcom" element={<TableMap />} />
        <Route path="/garcom/:tableId" element={<TableDetail />} />
        <Route path="/cozinha" element={<KitchenBoard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminProductList />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/novo"
          element={
            <RequireAuth>
              <AdminProductForm />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/:id/editar"
          element={
            <RequireAuth>
              <AdminProductForm />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <RequireAuth>
              <AdminAnalytics />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
