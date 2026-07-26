import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Sidebar() {
  const { user, isAdmin, isRecaudador, isCliente, hasPermission, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Nav construido según capacidades reales del rol:
  //  - Clientes: su propia experiencia.
  //  - Gestión (admin/recaudador/root): dashboard + items gateados por permiso,
  //    así cada rol solo ve lo que realmente puede usar.
  const navItems: { path: string; label: string; icon: string }[] = [];

  if (isCliente) {
    navItems.push(
      { path: '/mi-vehiculo', label: 'Mi Vehículo', icon: '🚗' },
      { path: '/mi-perfil', label: 'Mi Perfil', icon: '👤' },
    );
  } else {
    navItems.push({ path: '/dashboard', label: 'Dashboard', icon: '📊' });
    if (hasPermission('ZONAS_READ')) navItems.push({ path: '/zonas', label: 'Zonas & Espacios', icon: '🅿️' });
    if (hasPermission('TICKETS_READ')) navItems.push({ path: '/tickets', label: 'Tickets', icon: '🎫' });
    if (hasPermission('VEHICULOS_READ')) navItems.push({ path: '/vehiculos', label: 'Vehículos', icon: '🚗' });
    if (hasPermission('USUARIOS_READ')) navItems.push({ path: '/usuarios', label: 'Usuarios', icon: '👥' });
  }

  const roleLabel = isAdmin
    ? (user?.roles.includes('ROOT') ? 'ROOT' : 'ADMIN')
    : isRecaudador ? 'RECAUDADOR' : 'CLIENTE';

  const roleClass = isAdmin ? 'admin' : isRecaudador ? 'recaudador' : 'cliente';

  return (
    <>
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            {!collapsed && <span className="logo-text">ParkingDS</span>}
            {collapsed && <span className="logo-icon">🅿️</span>}
          </div>
          <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`sidebar-link ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={item.label}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {!collapsed && <span className="sidebar-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="sidebar-user">
              <div className="sidebar-avatar">{user?.username?.[0]?.toUpperCase() || 'U'}</div>
              <div className="sidebar-user-info">
                <span className="sidebar-username">{user?.username}</span>
                <span className={`role-chip ${roleClass}`}>{roleLabel}</span>
              </div>
            </div>
          )}
          <button className="sidebar-link logout-btn" onClick={logout} title="Cerrar sesión">
            <span className="sidebar-icon">🚪</span>
            {!collapsed && <span className="sidebar-label">Salir</span>}
          </button>
        </div>
      </aside>

      <style>{`
        .sidebar-mobile-toggle {
          display: none;
          position: fixed;
          top: 12px; left: 12px;
          z-index: 1100;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-primary);
          width: 38px; height: 38px;
          border-radius: var(--radius-sm);
          font-size: 1.1rem;
          align-items: center; justify-content: center;
        }
        .sidebar-overlay {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 998;
        }
        .sidebar {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: var(--sidebar-width);
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          z-index: 999;
          transition: width var(--transition);
          overflow: hidden;
        }
        .sidebar.collapsed { width: var(--sidebar-collapsed); }
        .sidebar-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.85rem 1rem;
          border-bottom: 1px solid var(--border);
          min-height: 56px;
        }
        .sidebar-logo { display: flex; align-items: center; }
        .logo-text {
          font-size: 1.1rem; font-weight: 800;
          background: linear-gradient(135deg, var(--accent), var(--purple));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; white-space: nowrap;
        }
        .logo-icon { font-size: 1.3rem; }
        .sidebar-collapse-btn {
          background: transparent; color: var(--text-muted);
          font-size: 0.65rem; padding: 0.2rem;
        }
        .sidebar-collapse-btn:hover { color: var(--text-primary); }
        .sidebar-nav {
          flex: 1; padding: 0.6rem;
          display: flex; flex-direction: column; gap: 0.15rem;
          overflow-y: auto;
        }
        .sidebar-link {
          display: flex; align-items: center;
          gap: 0.65rem; padding: 0.55rem 0.7rem;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.85rem; font-weight: 500;
          transition: all var(--transition);
          white-space: nowrap;
        }
        .sidebar-link:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          text-decoration: none;
        }
        .sidebar-link.active {
          background: rgba(88,166,255,0.1);
          color: var(--accent);
        }
        .sidebar-icon { font-size: 1.05rem; flex-shrink: 0; }
        .sidebar-footer {
          padding: 0.6rem;
          border-top: 1px solid var(--border);
        }
        .sidebar-user {
          display: flex; align-items: center;
          gap: 0.55rem; margin-bottom: 0.4rem;
          padding: 0.4rem 0.7rem;
        }
        .sidebar-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--purple));
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 0.8rem;
          color: white; flex-shrink: 0;
        }
        .sidebar-user-info { display: flex; flex-direction: column; overflow: hidden; gap: 0.15rem; }
        .sidebar-username { font-size: 0.78rem; font-weight: 600; color: var(--text-primary); }
        .logout-btn { color: var(--danger) !important; }
        .logout-btn:hover { background: var(--danger-bg) !important; }

        @media (max-width: 768px) {
          .sidebar-mobile-toggle { display: flex; }
          .sidebar-overlay { display: block; }
          .sidebar { transform: translateX(-100%); transition: transform var(--transition); }
          .sidebar.mobile-open { transform: translateX(0); }
          .sidebar-collapse-btn { display: none; }
        }
      `}</style>
    </>
  );
}
