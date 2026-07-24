// Types for the parking system DTOs

// ======== Auth ========
export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface RoleSelectionResponse {
  requiresRoleSelection: true;
  pre_auth_token: string;
  roles: string[];
}

// El login puede resolver directo (1 rol) o pedir selección de rol (>1 roles).
export type LoginResponse = TokenPair | RoleSelectionResponse;

export interface UserPayload {
  sub: string;        // userId (UUID)
  personId: string;   // idPersona (UUID)
  username: string;
  roles: string[];
  permissions: string[];
}

// ======== Personas ========
export interface Persona {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  dni: string;
  email: string;
  phone: string;
  nationality: string;
  address?: string;
  activo: boolean;
  created_at: string;
  updated_at?: string;
  user?: UserRef;
}

export interface UserRef {
  id: string;
  username: string;
  is_active: boolean;
}

export interface CreatePersonaRequest {
  firstName: string;
  lastName: string;
  middleName?: string;
  dni: string;
  email: string;
  phone: string;
  nationality: string;
  address?: string;
}

// ======== Zonas ========
export type TipoZona = 'VIP' | 'REGULAR' | 'INTERNA' | 'EXTERNA' | 'PREFERENCIAL';

export interface Zona {
  id: string;
  nombre: string;
  capacidad: number;
  codigo: string;
  descripcion?: string;
  estado: number;       // 1 = activa, 0 = inactiva
  tipo: TipoZona;
  fechaCreacion: string;
  fechaModificacion?: string;
  espacios?: Espacio[];
}

export interface CreateZonaRequest {
  nombre: string;
  descripcion?: string;
  tipo: TipoZona;
  capacidad: number;
}

// ======== Espacios ========
export type EstadoEspacio = 'DISPONIBLE' | 'OCUPADO' | 'INACTIVO';
export type TipoEspacio = 'AUTO' | 'MOTO' | 'BUSETA';

export interface Espacio {
  id: string;
  codigo: string;
  tipo: TipoEspacio;
  descripcion?: string;
  estado: EstadoEspacio;
  activo: boolean;
  idZona: string;
  nombreZona: string;
  fechaCreacion: string;
  fechaModificacion?: string;
}

export interface CreateEspacioRequest {
  idZona: string;
  descripcion?: string;
  tipo: TipoEspacio;
}

// ======== Tickets ========
export type EstadoTicket = 'activo' | 'pagado' | 'anulado';

export interface Ticket {
  id_ticket: string;
  id_espacio: string;
  id_usuario: string;
  placa: string;
  id_empleado: string;
  codigo_ticket: string;
  fecha_hora_ingreso: string;
  fecha_hora_salida?: string;
  estado_ticket: EstadoTicket;
  valor_recaudado?: number;
  categoria_vehiculo: string;
  categoria_zona: string;
  tarifa_hora_aplicada: number;
}

export interface CreateTicketRequest {
  id_espacio: string;
  placa: string;
}

// ======== Vehiculos ========
export type TipoVehiculo = 'Auto' | 'Motocicleta' | 'Camioneta';
export type Clasificacion = 'Electrico' | 'Gasolina' | 'Diesel' | 'Hibrido';

export interface Vehiculo {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  color: string;
  anio: number;
  tipo: string;
  activo: boolean;
  idPropietario?: string;
  clasificacion: string;
}

export interface CreateVehiculoRequest {
  tipo: TipoVehiculo;
  idPropietario?: string;
  datos: {
    placa: string;
    marca: string;
    modelo: string;
    color: string;
    anio: number;
    clasificacion: string;
    numeroPuertas?: number;
    capacidadMaletero?: number;
    tipoMoto?: string;
    cabina?: string;
    capacidadCarga?: number;
  };
}

// ======== Roles ========
export interface Role {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface RoleUser {
  id_user: string;
  id_role: string;
  active: boolean;
  role?: Role;
  user?: UserRef;
}
