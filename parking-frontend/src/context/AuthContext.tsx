import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi } from '../api';
import type { UserPayload } from '../types';

interface AuthState {
  token: string | null;
  user: UserPayload | null;
  isAuthenticated: boolean;
  loading: boolean;
  // Devuelve true si el usuario debe seleccionar rol antes de tener sesión.
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
  hasAnyPermission: (perms: string[]) => boolean;
  hasRole: (role: string) => boolean;
  isAdmin: boolean;
  isRecaudador: boolean;
  isCliente: boolean;
  // Selección de rol (usuarios con >1 rol)
  needsRoleSelection: boolean;
  availableRoles: string[];
  selectRole: (role: string) => Promise<void>;
  cancelRoleSelection: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function decodeToken(token: string): UserPayload | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // El access token trae `role` (único); mantenemos retrocompat con `roles`.
    const roles: string[] = payload.role ? [payload.role] : (payload.roles || []);
    return {
      sub: payload.sub,
      personId: payload.personId,
      username: payload.username,
      roles,
      permissions: payload.permissions || [],
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPayload | null>(() => {
    const t = localStorage.getItem('token');
    if (!t) return null;
    const decoded = decodeToken(t);
    // Force re-login if the token is old and missing personId
    if (decoded && !decoded.personId) {
      localStorage.removeItem('token');
      return null;
    }
    return decoded;
  });
  // Also clear token state if we returned null above
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  // Estado del flujo de selección de rol (token pre-auth en memoria, nunca en localStorage)
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  useEffect(() => {
    if (token) {
      authApi.validate()
        .then(() => setLoading(false))
        .catch(() => {
          setToken(null);
          setUser(null);
          localStorage.removeItem('token');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  // Guarda el par de tokens (access + refresh) y actualiza el estado de sesión.
  const applyTokens = (accessToken: string, refreshToken?: string) => {
    const decoded = decodeToken(accessToken);
    setToken(accessToken);
    setUser(decoded);
    localStorage.setItem('token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    setPreAuthToken(null);
    setAvailableRoles([]);
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    const res = await authApi.login(username, password);
    if ('requiresRoleSelection' in res) {
      // Usuario con >1 rol: no hay sesión aún, se pide elegir rol.
      setPreAuthToken(res.pre_auth_token);
      setAvailableRoles(res.roles);
      return true;
    }
    applyTokens(res.access_token, res.refresh_token);
    return false;
  };

  const selectRole = async (role: string) => {
    if (!preAuthToken) throw new Error('No hay una selección de rol en curso');
    const res = await authApi.selectRole(role, preAuthToken);
    applyTokens(res.access_token, res.refresh_token);
  };

  const cancelRoleSelection = () => {
    setPreAuthToken(null);
    setAvailableRoles([]);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setPreAuthToken(null);
    setAvailableRoles([]);
  };

  const hasPermission = (perm: string) => user?.permissions.includes(perm) ?? false;
  const hasAnyPermission = (perms: string[]) => perms.some(p => hasPermission(p));
  const hasRole = (role: string) => user?.roles.some(r => r.toUpperCase() === role.toUpperCase()) ?? false;

  const isAdmin = hasRole('ROOT') || hasRole('ADMIN');
  const isRecaudador = hasRole('RECAUDADOR');
  const isCliente = !isAdmin && !isRecaudador;

  return (
    <AuthContext.Provider value={{
      token, user, isAuthenticated: !!token, loading,
      login, logout, hasPermission, hasAnyPermission, hasRole,
      isAdmin, isRecaudador, isCliente,
      needsRoleSelection: !!preAuthToken,
      availableRoles, selectRole, cancelRoleSelection,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
