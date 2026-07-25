import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import DashboardPage from './pages/DashboardPage';
import ZonasPage from './pages/ZonasPage';
import TicketsPage from './pages/TicketsPage';
import VehiculosPage from './pages/VehiculosPage';
import UsuariosPage from './pages/UsuariosPage';
import MiVehiculoPage from './pages/MiVehiculoPage';
import MiPerfilPage from './pages/MiPerfilPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /><span>Cargando...</span></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleRoute({ children, allowAdmin, allowRecaudador, allowCliente }: {
  children: ReactNode;
  allowAdmin?: boolean;
  allowRecaudador?: boolean;
  allowCliente?: boolean;
}) {
  const { isAdmin, isRecaudador, isCliente } = useAuth();
  if (allowAdmin && isAdmin) return <>{children}</>;
  if (allowRecaudador && isRecaudador) return <>{children}</>;
  if (allowCliente && isCliente) return <>{children}</>;
  // Redirect to appropriate home
  if (isAdmin) return <Navigate to="/dashboard" replace />;
  if (isRecaudador) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/mi-vehiculo" replace />;
}

// Ruta de gestión gateada por PERMISO. Los clientes se envían a su vista;
// un gestor sin el permiso concreto vuelve al dashboard.
function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { isCliente, hasPermission } = useAuth();
  if (isCliente) return <Navigate to="/mi-vehiculo" replace />;
  if (!hasPermission(perm)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  // No mostrar el botón de regresar en las páginas principales de cada rol
  const isMainPage = ['/dashboard', '/mi-vehiculo', '/login'].includes(location.pathname);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        {!isMainPage && (
          <div style={{ padding: '1rem 2rem 0 2rem' }}>
            <button 
              className="btn btn-ghost" 
              onClick={() => navigate(-1)} 
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>←</span> Regresar
            </button>
          </div>
        )}
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
}

function DefaultRedirect() {
  const { isAdmin, isRecaudador, isCliente } = useAuth();
  if (isAdmin) return <Navigate to="/dashboard" replace />;
  if (isRecaudador) return <Navigate to="/dashboard" replace />;
  if (isCliente) return <Navigate to="/mi-vehiculo" replace />;
  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated, loading, needsRoleSelection } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /><span>Cargando...</span></div>;

  // Usuario autenticado con pre-auth pendiente: pantalla de selección de rol.
  const loginElement = isAuthenticated
    ? <DefaultRedirect />
    : (needsRoleSelection ? <RoleSelectionPage /> : <LoginPage />);

  return (
    <Routes>
      <Route path="/login" element={loginElement} />

      {/* Rutas de gestión — gateadas por permiso (el dashboard por rol) */}
      <Route path="/dashboard" element={
        <ProtectedRoute><RoleRoute allowAdmin allowRecaudador><AppLayout><DashboardPage /></AppLayout></RoleRoute></ProtectedRoute>
      } />
      <Route path="/zonas" element={
        <ProtectedRoute><RequirePermission perm="ZONAS_READ"><AppLayout><ZonasPage /></AppLayout></RequirePermission></ProtectedRoute>
      } />
      <Route path="/vehiculos" element={
        <ProtectedRoute><RequirePermission perm="VEHICULOS_READ"><AppLayout><VehiculosPage /></AppLayout></RequirePermission></ProtectedRoute>
      } />
      <Route path="/usuarios" element={
        <ProtectedRoute><RequirePermission perm="USUARIOS_READ"><AppLayout><UsuariosPage /></AppLayout></RequirePermission></ProtectedRoute>
      } />
      <Route path="/tickets" element={
        <ProtectedRoute><RequirePermission perm="TICKETS_READ"><AppLayout><TicketsPage /></AppLayout></RequirePermission></ProtectedRoute>
      } />

      {/* Client routes */}
      <Route path="/mi-vehiculo" element={
        <ProtectedRoute><RoleRoute allowCliente><AppLayout><MiVehiculoPage /></AppLayout></RoleRoute></ProtectedRoute>
      } />
      <Route path="/mi-perfil" element={
        <ProtectedRoute><RoleRoute allowCliente><AppLayout><MiPerfilPage /></AppLayout></RoleRoute></ProtectedRoute>
      } />

      {/* Default */}
      <Route path="*" element={
        <ProtectedRoute><DefaultRedirect /></ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
