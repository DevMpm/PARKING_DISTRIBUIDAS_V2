import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function RoleSelectionPage() {
  const { availableRoles, selectRole, cancelRoleSelection } = useAuth();
  const [role, setRole] = useState(availableRoles[0] ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!role) { setError('Selecciona un rol para continuar'); return; }
    setLoading(true);
    try {
      await selectRole(role);
      // Al obtener el access token, el router redirige automáticamente.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo seleccionar el rol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>🅿️ ParkingDS</h1>
          <p>Selecciona el rol con el que deseas ingresar</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleContinue}>
          <div className="form-group">
            <label className="form-label" htmlFor="role-select">Rol</label>
            <select
              id="role-select"
              value={role}
              onChange={e => setRole(e.target.value)}
              autoFocus
            >
              {availableRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Continuando...' : 'Continuar'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={cancelRoleSelection}
            style={{ width: '100%', marginTop: '0.75rem' }}
          >
            Volver
          </button>
        </form>
      </div>
    </div>
  );
}
