import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { personasApi } from '../api';

// Validation helpers
const sanitize = (val: string) => val.replace(/<[^>]*>/g, '').trim();
const isValidDni = (dni: string) => /^\d{10}$/.test(dni);
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone: string) => /^\+?\d{5,17}$/.test(phone);
const isValidName = (name: string) => /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]{2,30}$/.test(name);

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regForm, setRegForm] = useState({
    firstName: '', lastName: '', middleName: '',
    dni: '', email: '', phone: '', nationality: 'Ecuatoriano', address: '',
  });
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanUser = sanitize(username);
    const cleanPass = sanitize(password);
    if (!cleanUser || !cleanPass) { setError('Completa todos los campos'); return; }
    setLoading(true);
    try {
      const requiresRoleSelection = await login(cleanUser, cleanPass);
      // Si el usuario tiene >1 rol, la ruta /login renderiza la pantalla de
      // selección de rol; no navegamos al dashboard todavía.
      if (!requiresRoleSelection) {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const validateRegister = (): boolean => {
    const errors: Record<string, string> = {};
    if (!isValidName(regForm.firstName)) errors.firstName = 'Nombre inválido (2-30 letras)';
    if (!isValidName(regForm.lastName)) errors.lastName = 'Apellido inválido (2-30 letras)';
    if (regForm.middleName && !isValidName(regForm.middleName)) errors.middleName = 'Segundo nombre inválido';
    if (!isValidDni(regForm.dni)) errors.dni = 'Cédula ecuatoriana de 10 dígitos';
    if (!isValidEmail(regForm.email)) errors.email = 'Email inválido';
    if (!isValidPhone(regForm.phone)) errors.phone = 'Teléfono inválido (5-17 dígitos)';
    if (!regForm.nationality || regForm.nationality.length < 3) errors.nationality = 'Nacionalidad requerida (mín 3 chars)';
    setRegErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!validateRegister()) return;
    setLoading(true);
    try {
      const sanitized = {
        firstName: sanitize(regForm.firstName),
        lastName: sanitize(regForm.lastName),
        middleName: regForm.middleName ? sanitize(regForm.middleName) : undefined,
        dni: sanitize(regForm.dni),
        email: sanitize(regForm.email).toLowerCase(),
        phone: sanitize(regForm.phone),
        nationality: sanitize(regForm.nationality),
        address: regForm.address ? sanitize(regForm.address) : undefined,
      };
      const res = await personasApi.create(sanitized);
      setSuccess(`¡Registro exitoso! Tu usuario es: ${res.user.username} y tu contraseña inicial es tu cédula: ${sanitized.dni}`);
      setMode('login');
      setUsername(res.user.username);
      setPassword('');
      setRegForm({ firstName: '', lastName: '', middleName: '', dni: '', email: '', phone: '', nationality: 'Ecuatoriano', address: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const updateReg = (field: string, value: string) => {
    setRegForm(prev => ({ ...prev, [field]: value }));
    if (regErrors[field]) setRegErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>🅿️ ParkingDS</h1>
          <p>Sistema de Gestión de Parqueo Distribuido</p>
        </div>

        {/* Tab Toggle */}
        <div className="tab-toggle" style={{ width: '100%', marginBottom: '1.25rem' }}>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }} style={{ flex: 1 }}>
            Iniciar Sesión
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); setSuccess(''); }} style={{ flex: 1 }}>
            Registrarse
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-user">Usuario</label>
              <input
                id="login-user" type="text" value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario" required autoFocus
                maxLength={50}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-pass">Contraseña</label>
              <input
                id="login-pass" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña" required
                maxLength={100}
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input value={regForm.firstName} onChange={e => updateReg('firstName', e.target.value)}
                  placeholder="Juan" maxLength={30} required />
                {regErrors.firstName && <div className="form-error">{regErrors.firstName}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Apellido *</label>
                <input value={regForm.lastName} onChange={e => updateReg('lastName', e.target.value)}
                  placeholder="Pérez" maxLength={30} required />
                {regErrors.lastName && <div className="form-error">{regErrors.lastName}</div>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Segundo Nombre</label>
              <input value={regForm.middleName} onChange={e => updateReg('middleName', e.target.value)}
                placeholder="Carlos (opcional)" maxLength={30} />
              {regErrors.middleName && <div className="form-error">{regErrors.middleName}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Cédula (DNI) *</label>
              <input value={regForm.dni} onChange={e => updateReg('dni', e.target.value.replace(/\D/g, ''))}
                placeholder="1712345678" maxLength={10} required />
              {regErrors.dni && <div className="form-error">{regErrors.dni}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" value={regForm.email} onChange={e => updateReg('email', e.target.value)}
                placeholder="juan.perez@email.com" maxLength={50} required />
              {regErrors.email && <div className="form-error">{regErrors.email}</div>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Teléfono *</label>
                <input value={regForm.phone} onChange={e => updateReg('phone', e.target.value.replace(/[^0-9+]/g, ''))}
                  placeholder="+593991234567" maxLength={17} required />
                {regErrors.phone && <div className="form-error">{regErrors.phone}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Nacionalidad *</label>
                <input value={regForm.nationality} onChange={e => updateReg('nationality', e.target.value)}
                  placeholder="Ecuatoriano" maxLength={30} required />
                {regErrors.nationality && <div className="form-error">{regErrors.nationality}</div>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input value={regForm.address} onChange={e => updateReg('address', e.target.value)}
                placeholder="Av. Principal 123 (opcional)" maxLength={100} />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Registrando...' : 'Crear Cuenta'}
            </button>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.75rem' }}>
              Se asignará automáticamente el rol CLIENTE. Tu contraseña será tu cédula.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
