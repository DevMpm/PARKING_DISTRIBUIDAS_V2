/**
 * Catálogo de microservicios y resolución del servicio dueño de cada permiso.
 *
 * El servicio dueño se deriva del prefijo del nombre del permiso (ej: 'ZONAS_CREATE'
 * -> 'zonas-service'). Este mapeo se usa SOLO en el sembrado/backfill de la columna
 * `service` de la entidad Permission; la autorización pull (Fase 3+) filtra por la
 * columna ya poblada, no por el prefijo.
 *
 * Los `serviceId` deben coincidir con los que envían los consumidores en la Fase 4.
 */
export const SERVICE_IDS = {
  ZONAS: 'zonas-service',
  TICKETS: 'tickets-service',
  VEHICULOS: 'vehiculos-service',
  ASIGNACIONES: 'assignment-service',
  USUARIOS: 'usuarios-service',
  AUDITORIA: 'auditoria-service'
} as const;

export type ServiceId = (typeof SERVICE_IDS)[keyof typeof SERVICE_IDS];

// Prefijo del nombre del permiso -> serviceId dueño.
const PREFIX_TO_SERVICE: Record<string, ServiceId> = {
  ZONAS: SERVICE_IDS.ZONAS,
  TICKETS: SERVICE_IDS.TICKETS,
  VEHICULOS: SERVICE_IDS.VEHICULOS,
  ASIGNACIONES: SERVICE_IDS.ASIGNACIONES,
  USUARIOS: SERVICE_IDS.USUARIOS,
  ROLES: SERVICE_IDS.USUARIOS,
  ROLEUSERS: SERVICE_IDS.USUARIOS,
  AUDITORIA: SERVICE_IDS.AUDITORIA
};

/**
 * Devuelve el serviceId dueño de un permiso según su prefijo, o null si no hay match.
 * Ej: 'VEHICULOS_READ' -> 'vehiculos-service'.
 */
export function resolveServiceForPermission(permissionName: string): ServiceId | null {
  const prefix = permissionName.split('_')[0];
  return PREFIX_TO_SERVICE[prefix] ?? null;
}
