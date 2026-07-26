import { useEffect, useState } from 'react';
import { personasApi, roleUsersApi } from '../api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import type { Persona } from '../types';

interface UserWithRoles extends Persona {
  assignedRoles: { roleName: string; roleId: string; active: boolean }[];
}

const ASSIGNABLE_ROLES = ['CLIENTE', 'RECAUDADOR', 'ADMIN', 'ROOT'];

export default function UsuariosPage() {
  const { addToast, ToastContainer } = useToast();
  const { hasPermission } = useAuth();
  const canAssignRole = hasPermission('ROLEUSERS_CREATE');
  const canToggleActive = hasPermission('USUARIOS_UPDATE');
  const showActions = canAssignRole || canToggleActive;
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [personas, allRoleUsers] = await Promise.all([
        personasApi.getAll(),
        roleUsersApi.getAll() as Promise<{ id_user: string; id_role: string; active: boolean; role: { name: string; id: string } }[]>,
      ]);

      const enriched: UserWithRoles[] = personas.map(p => ({
        ...p,
        assignedRoles: allRoleUsers
          .filter(ru => p.user && ru.id_user === p.user.id)
          .map(ru => ({ roleName: ru.role?.name || '?', roleId: ru.id_role, active: ru.active })),
      }));
      setUsers(enriched);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error cargando usuarios', 'error');
    }
    setLoading(false);
  };

  const handleAssignRole = async () => {
    if (!selectedUser?.user || !selectedRole) return;
    setAssigning(true);
    try {
      await roleUsersApi.assign(selectedUser.user.id, selectedRole);
      addToast(`Rol ${selectedRole} asignado a ${selectedUser.first_name}`, 'success');
      setShowRoleModal(false);
      setSelectedRole('');
      await loadData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error al asignar rol', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleToggleActive = async (persona: Persona) => {
    try {
      if (persona.activo) {
        await personasApi.deactivate(persona.id);
        addToast(`${persona.first_name} desactivado`, 'info');
      } else {
        await personasApi.activate(persona.id);
        addToast(`${persona.first_name} activado`, 'success');
      }
      await loadData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const getRoleChipClass = (roleName: string) => {
    switch (roleName.toUpperCase()) {
      case 'ROOT': return 'root';
      case 'ADMIN': return 'admin';
      case 'RECAUDADOR': return 'recaudador';
      default: return 'cliente';
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /><span>Cargando usuarios...</span></div>;

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Usuarios</h1>
          <p className="page-subtitle">Administra usuarios y asigna roles</p>
        </div>
        <span className="badge badge-neutral">{users.length} usuarios</span>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        {['ROOT', 'ADMIN', 'RECAUDADOR', 'CLIENTE'].map(role => {
          const count = users.filter(u => u.assignedRoles.some(r => r.roleName === role && r.active)).length;
          const icons: Record<string, string> = { ROOT: '🔑', ADMIN: '⚙️', RECAUDADOR: '💰', CLIENTE: '👤' };
          const colors: Record<string, string> = { ROOT: 'red', ADMIN: 'yellow', RECAUDADOR: 'purple', CLIENTE: 'blue' };
          return (
            <div key={role} className="card stat-card">
              <div className={`stat-icon ${colors[role]}`}>{icons[role]}</div>
              <div><div className="stat-value">{count}</div><div className="stat-label">{role}</div></div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Todos los Usuarios</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>DNI</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Estado</th>
                {showActions && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.first_name} {u.last_name}</td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.user?.username || '—'}</span></td>
                  <td>{u.dni}</td>
                  <td style={{ fontSize: '0.78rem' }}>{u.email}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {u.assignedRoles.filter(r => r.active).map(r => (
                        <span key={r.roleId} className={`role-chip ${getRoleChipClass(r.roleName)}`}>
                          {r.roleName}
                        </span>
                      ))}
                      {u.assignedRoles.filter(r => r.active).length === 0 && (
                        <span className="badge badge-neutral">Sin rol</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${u.activo ? 'badge-success' : 'badge-danger'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {showActions && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {canAssignRole && (
                          <button
                            className="btn btn-xs btn-primary"
                            onClick={() => { setSelectedUser(u); setShowRoleModal(true); setSelectedRole(''); }}
                            title="Asignar rol"
                          >
                            🏷️ Rol
                          </button>
                        )}
                        {canToggleActive && (
                          <button
                            className={`btn btn-xs ${u.activo ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => handleToggleActive(u)}
                          >
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Assignment Modal */}
      {showRoleModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🏷️ Asignar Rol</h2>
            <div style={{ padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{selectedUser.first_name} {selectedUser.last_name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Usuario: {selectedUser.user?.username} · DNI: {selectedUser.dni}
              </div>
              <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Roles actuales:</span>
                {selectedUser.assignedRoles.filter(r => r.active).map(r => (
                  <span key={r.roleId} className={`role-chip ${getRoleChipClass(r.roleName)}`}>{r.roleName}</span>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Seleccionar nuevo rol</label>
              <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
                <option value="">Elegir rol...</option>
                {ASSIGNABLE_ROLES.map(r => (
                  <option key={r} value={r} disabled={selectedUser.assignedRoles.some(ar => ar.roleName === r && ar.active)}>
                    {r} {selectedUser.assignedRoles.some(ar => ar.roleName === r && ar.active) ? '(ya asignado)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowRoleModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAssignRole} disabled={!selectedRole || assigning}>
                {assigning ? 'Asignando...' : 'Asignar Rol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
