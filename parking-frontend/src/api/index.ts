import type {
  Zona, CreateZonaRequest,
  Espacio, CreateEspacioRequest, EstadoEspacio,
  Ticket, CreateTicketRequest,
  Vehiculo, CreateVehiculoRequest,
  Persona, CreatePersonaRequest,
  Role,
  LoginResponse, TokenPair,
} from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.message || data?.detail || data?.error || `Error ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }

  return data as T;
}

// ======== Auth ========
export const authApi = {
  login: (username: string, password: string) =>
    request<LoginResponse>('/usuarios/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  // Intercambia el token pre-auth por un par de tokens con el rol elegido.
  selectRole: (role: string, preAuthToken: string) =>
    request<TokenPair>('/usuarios/auth/select-role', {
      method: 'POST',
      headers: { Authorization: `Bearer ${preAuthToken}` },
      body: JSON.stringify({ role }),
    }),
  validate: () =>
    request<{ userId: string; username: string; role?: string; roles: string[]; permissions: string[] }>('/usuarios/auth/validate'),
};

// ======== Zonas ========
export const zonasApi = {
  getAll: () => request<Zona[]>('/v1/zonas/'),
  create: (data: CreateZonaRequest) =>
    request<Zona>('/v1/zonas/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: CreateZonaRequest) =>
    request<Zona>(`/v1/zonas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleActive: (id: string) =>
    request<void>(`/v1/zonas/${id}`, { method: 'PATCH' }),
};

// ======== Espacios ========
export const espaciosApi = {
  getAll: () => request<Espacio[]>('/v1/espacios/'),
  getById: (id: string) => request<Espacio>(`/v1/espacios/${id}`),
  create: (data: CreateEspacioRequest) =>
    request<Espacio>('/v1/espacios/', { method: 'POST', body: JSON.stringify(data) }),
  updateEstado: (id: string, estado: EstadoEspacio) =>
    request<Espacio>(`/v1/espacios/${id}`, { method: 'POST', body: JSON.stringify(estado) }),
  getByZona: (idZona: string) => request<Espacio[]>(`/v1/espacios/zona/${idZona}`),
  delete: (id: string) => request<void>(`/v1/espacios/${id}`, { method: 'DELETE' }),
};

// ======== Tickets ========
export const ticketsApi = {
  create: (data: CreateTicketRequest) =>
    request<Ticket>('/v1/tickets/', { method: 'POST', body: JSON.stringify(data) }),
  getById: (id: string) => request<Ticket>(`/v1/tickets/${id}`),
  registrarSalida: (id: string, fecha?: string) =>
    request<Ticket>(`/v1/tickets/${id}/salida`, {
      method: 'PATCH',
      body: JSON.stringify({ fecha_hora_salida: fecha || null }),
    }),
  anular: (id: string, motivo?: string) =>
    request<Ticket>(`/v1/tickets/${id}/anular`, {
      method: 'PATCH',
      body: JSON.stringify({ motivo: motivo || null }),
    }),
};

// ======== Vehiculos ========
export const vehiculosApi = {
  getAll: () => request<Vehiculo[]>('/vehiculos'),
  getById: (id: string) => request<Vehiculo>(`/vehiculos/${id}`),
  getByPlaca: (placa: string) => request<Vehiculo>(`/vehiculos/placa/${placa}`),
  getByPropietario: (idPropietario: string) => request<Vehiculo[]>(`/vehiculos/propietario/${idPropietario}`),
  create: (data: CreateVehiculoRequest) =>
    request<Vehiculo>('/vehiculos', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<Vehiculo>(`/vehiculos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<Vehiculo>(`/vehiculos/${id}`, { method: 'DELETE' }),
};

// ======== Personas ========
export const personasApi = {
  getAll: () => request<Persona[]>('/usuarios/personas'),
  getById: (id: string) => request<Persona>(`/usuarios/personas/${id}`),
  getByDni: (dni: string) => request<Persona>(`/usuarios/personas/dni/${dni}`),
  create: (data: CreatePersonaRequest) =>
    request<{ persona: Persona; user: { id: string; username: string } }>('/usuarios/personas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<CreatePersonaRequest>) =>
    request<Persona>(`/usuarios/personas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  activate: (id: string) =>
    request<Persona>(`/usuarios/personas/activate/${id}`, { method: 'PATCH' }),
  deactivate: (id: string) =>
    request<Persona>(`/usuarios/personas/deactivate/${id}`, { method: 'PATCH' }),
};

// ======== Roles ========
export const rolesApi = {
  getAll: () => request<Role[]>('/usuarios/roles'),
  getByName: (name: string) => request<Role>(`/usuarios/roles/name/${name}`),
};

// ======== RoleUsers ========
export const roleUsersApi = {
  getAll: () => request<unknown[]>('/usuarios/roleusers'),
  getByUser: (userId: string) => request<unknown[]>(`/usuarios/roleusers/user/${userId}`),
  assign: (id_user: string, role_name: string) =>
    request<unknown>('/usuarios/roleusers', { method: 'POST', body: JSON.stringify({ id_user, role_name }) }),
  deactivate: (id_user: string, id_role: string) =>
    request<unknown>(`/usuarios/roleusers/deactivate/${id_user}/${id_role}`, { method: 'PATCH' }),
  activate: (id_user: string, id_role: string) =>
    request<unknown>(`/usuarios/roleusers/activate/${id_user}/${id_role}`, { method: 'PATCH' }),
};
