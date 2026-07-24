# Plan de Implementación — Nuevo Flujo de Autenticación y Autorización

> Proyecto: PARKING_DISTRIBUIDAS_V2
> Alcance: (A) Login con selección de rol vía token `pre-auth` · (B) Autorización *pull + caché por servicio*
> Estado actual analizado: `gestion-usuarios` (NestJS, emisor), `assignment-service` / `ticket-service` / `vehiculos` / `ModuloZonas` (consumidores), `parking-frontend` (React).

---

## Estado de avance

| Fase | Descripción | Estado |
|---|---|---|
| **1** | Pre-auth + selección de rol | ✅ **Completada y verificada end-to-end** |
| **2** | Modelo: concepto de "Servicio" en permisos | ✅ **Completada y verificada (backfill en BD)** |
| **3** | Emisor: endpoint interno de permisos + eventos | ✅ **Completada y verificada (endpoint + RabbitMQ)** |
| **4** | Consumidores: pull + caché + invalidación | ✅ **Completada — los 4 consumidores migrados y verificados** |

---

## 0. Resumen ejecutivo

| Cambio | ¿Plausible? | Esfuerzo | Rompe lo existente |
|---|---|---|---|
| **A** — pre-auth + selección de rol | ✅ | Bajo-medio | No (aditivo) |
| **B** — permisos pull + caché por servicio | ✅ | Medio-alto | Sí (invierte push→pull + migración de modelo) |

**A y B son independientes.** Se puede entregar A primero y B después. Recomendación: implementar en fases (Fase 1 = A, Fases 2-4 = B).

### Punto de partida (lo que ya existe y sirve)
- Firma **RS256** con `kid: main-key-2026` y JWKS publicado en `/auth/jwks` → `gestion-usuarios/src/auth/auth.service.ts`.
- Consumidores validan firma vía `jwks-rsa` con caché → `assignment-service/src/auth/strategies/jwt.strategy.ts`.
- **RabbitMQ** ya conectado (`gestion-usuarios/src/audit/event-publisher.ts`) → se reutiliza para invalidar caché.
- TTL actual: access `1h` (`auth.module.ts`), refresh `30d` (`auth.service.ts`).
- `HttpModule` ya importado en el `AuthModule` de los consumidores → listo para llamadas HTTP salientes.

### Huecos detectados (a resolver en este plan)
1. **No existe token `pre-auth`**: hoy `login()` mete *todos* los roles + *todos* los permisos en un único token.
2. **Los guards no distinguen tipo de token**: un `pre-auth` podría usarse como `access`.
3. **`RolePermission` no tiene concepto de "servicio"** (`role-permission.entity.ts` solo tiene `id_role` + `id_permission`). El servicio hoy está *implícito* en el prefijo del permiso (`ZONAS_*`, `TICKETS_*`).
4. **Autorización es *push***: los permisos viajan en el JWT / header `x-user-permissions`. El diseño nuevo pide *pull* (el consumidor consulta y cachea).

---

# FASE 1 — Cambio A: Login con selección de rol (`pre-auth`)  ✅ COMPLETADA

> **Verificada end-to-end el 2026-07-24** contra el stack Docker. Usuario de prueba
> creado: `mrol` / `1700200015` (roles CLIENTE + ADMIN + RECAUDADOR) vía
> [seed_multirole_user.py](seed_multirole_user.py). Resultados: login multi-rol →
> `requiresRoleSelection` ✔ · `select-role` rol válido → access ✔ · rol ajeno → 403 ✔ ·
> token `pre-auth` en endpoint normal → 401 ✔.

### ⚠️ Paso extra NO previsto: whitelist en Kong (obligatorio)
El gateway valida cada request llamando a `/auth/validate` (que ahora rechaza `pre-auth`),
salvo rutas whitelisted. Hubo que añadir `select-role` a la whitelist en **`kong.yml`**
(los 6 bloques `public_paths`). **Ojo con el patrón Lua**: el `-` es un cuantificador, así
que el guion debe escaparse:
```lua
{ path = "^/api/usuarios/auth/select%-role", method = "POST" },
```
Sin este escape, el match falla y Kong bloquea el flujo con 401. Recargar con
`docker exec kong-gateway kong reload` tras editar `kong.yml`.

### Objetivo
- 1 rol activo → emitir `access` + `refresh` (comportamiento actual). TTL access = **15 min**.
- \>1 roles → emitir token `pre-auth` (TTL **5 min**) → pantalla de selección → intercambio por `access` (rol único) + `refresh`.

### Claims de token (nuevo estándar)
```jsonc
// pre-auth
{ "sub": "...", "username": "...", "roles": ["ADMIN","RECAUDADOR"], "type": "pre-auth" }  // TTL 5m, SIN permissions

// access
{ "sub":"...", "personId":"...", "username":"...", "role":"ADMIN", "type":"access", ... }  // TTL 15m, rol ÚNICO

// refresh
{ ...igual que access..., "type":"refresh" }  // TTL 30d
```

### Backend — `gestion-usuarios`

**1. `src/auth/auth.module.ts`** — bajar TTL por defecto del access.
```ts
signOptions: { expiresIn: '15m', algorithm: 'RS256' }  // antes: '1h'
```

**2. `src/auth/auth.service.ts`** — refactor de `login()` + nuevos métodos.
```ts
// login(): decide entre pre-auth y access
async login(user: any, ip?: string) {
  const activeRoles = user.userRoles.filter((ur:any) => ur.active).map((ur:any) => ur.role.name);

  if (activeRoles.length === 0) throw new UnauthorizedException('El usuario no tiene roles activos');

  if (activeRoles.length > 1) {
    const preToken = this.jwtService.sign(
      { sub: user.id, username: user.username, roles: activeRoles, type: 'pre-auth' },
      { keyid: 'main-key-2026', expiresIn: '5m' },
    );
    return { requiresRoleSelection: true, pre_auth_token: preToken, roles: activeRoles };
  }

  return this.issueAccessTokens(user, activeRoles[0], ip); // rol único
}

// Emite access(15m) + refresh(30d) para UN rol
private issueAccessTokens(user: any, role: string, ip?: string) {
  const payload = {
    sub: user.id, personId: user.id_person, username: user.username,
    role, // rol ÚNICO (antes: roles[])
    audience: ["zonas-service","usuarios-service","vehiculos-service","tickets-service"],
    ip: ip ?? 'desconocida',
    // NOTA Fase 1: aún puedes incluir `permissions` filtrados por rol para no romper consumidores.
    // Se elimina en Fase 3 (pull).
  };
  return {
    access_token: this.jwtService.sign({ ...payload, type: 'access' }, { keyid: 'main-key-2026' }),
    refresh_token: this.jwtService.sign({ ...payload, type: 'refresh' }, { keyid: 'main-key-2026', expiresIn: '30d' }),
  };
}

// Intercambio pre-auth -> access
async selectRole(preAuthUser: any, role: string, ip?: string) {
  if (preAuthUser.type !== 'pre-auth') throw new UnauthorizedException('Token no es de tipo pre-auth');
  if (!preAuthUser.roles.includes(role)) throw new ForbiddenException('El usuario no posee ese rol');
  const user = await this.usersService.findOneByUsername(preAuthUser.username);
  if (!user || !user.active) throw new UnauthorizedException('Usuario inactivo');
  return this.issueAccessTokens(user, role, ip);
}
```
> `refreshTokens()` debe re-emitir conservando el `role` del refresh (no volver a `login()`, que reabriría la selección). Leer `decoded.role` y llamar `issueAccessTokens(user, decoded.role, ip)`.

**3. `src/auth/dto/select-role.dto.ts`** (nuevo)
```ts
export class SelectRoleDto {
  @IsString() @IsNotEmpty() role: string;
}
```

**4. `src/auth/strategies/jwt.strategy.ts`** — propagar `type` y `role`.
```ts
async validate(payload: any) {
  return { userId: payload.sub, username: payload.username,
           role: payload.role, roles: payload.roles, type: payload.type };
}
```

**5. `src/auth/guards/pre-auth.guard.ts`** (nuevo) — valida SOLO tokens `pre-auth`.
```ts
// Extiende AuthGuard('jwt') y en handleRequest rechaza si user.type !== 'pre-auth'
```

**6. `src/auth/guards/jwt-auth.guard.ts`** — rechazar `pre-auth` en endpoints normales.
```ts
handleRequest(err, user) {
  if (err || !user) throw err || new UnauthorizedException();
  if (user.type === 'pre-auth') throw new UnauthorizedException('Token pre-auth no válido para esta operación');
  return user;
}
```

**7. `src/auth/auth.controller.ts`** — nuevo endpoint.
```ts
@UseGuards(PreAuthGuard)
@Post('select-role')
@HttpCode(200)
async selectRole(@Body() dto: SelectRoleDto, @Req() req, @ClientIp() ip: string) {
  return this.authService.selectRole(req.user, dto.role, ip);
}
```

### Frontend — `parking-frontend`

**8. `src/api/index.ts`** — extender `authApi`.
```ts
login: (u,p) => request<LoginResponse>('/usuarios/auth/login', {...}),
// LoginResponse = { access_token, refresh_token } | { requiresRoleSelection, pre_auth_token, roles }
selectRole: (role: string, preAuthToken: string) =>
  request('/usuarios/auth/select-role', {
    method: 'POST',
    headers: { Authorization: `Bearer ${preAuthToken}` },
    body: JSON.stringify({ role }),
  }),
```

**9. `src/context/AuthContext.tsx`** — manejar bifurcación.
- `login()`: si la respuesta trae `requiresRoleSelection`, **no** guardar token; guardar `pre_auth_token` + `roles` en estado y exponer flag `needsRoleSelection`.
- Nuevo `selectRole(role)`: llama `authApi.selectRole`, decodifica el `access_token`, guarda en `localStorage`.
- `decodeToken()`: adaptar `roles: [payload.role]` (ahora rol único) — mantener retrocompat con `payload.roles`.

**10. `src/pages/RoleSelectionPage.tsx`** (nuevo) — `<select>` con los roles + botón "Continuar" → `selectRole`. Ruta protegida por `needsRoleSelection`.

**11. Router** — si `needsRoleSelection` redirige a `/select-role`; al obtener access, a `/dashboard`.

### Pruebas Fase 1
- Usuario con 1 rol → login directo al dashboard.
- Usuario con >1 roles → 200 con `requiresRoleSelection`; `/auth/select-role` con rol válido → access; con rol ajeno → 403.
- Token `pre-auth` contra cualquier endpoint normal → 401.

---

# FASE 2 — Cambio B (modelo): concepto de "Servicio" en permisos  ✅ COMPLETADA

> **Verificada el 2026-07-24.** Se optó por la **columna explícita** `service` en
> `Permission` (no el prefijo frágil). `synchronize: true` creó la columna y el seeder
> hizo backfill de los 29 permisos existentes. Verificación en BD:
>
> | service | # permisos |
> |---|---|
> | zonas-service | 4 (ZONAS_*) |
> | tickets-service | 4 (TICKETS_*) |
> | vehiculos-service | 4 (VEHICULOS_*) |
> | assignment-service | 4 (ASIGNACIONES_*) |
> | usuarios-service | 13 (USUARIOS_/ROLES_/ROLEUSERS_/AUDITORIA_) |
>
> Sin filas `NULL`. Implementación real:
> - [permission.entity.ts](gestion-usuarios/src/roles/entities/permission.entity.ts) — columna `service`.
> - [service-catalog.ts](gestion-usuarios/src/roles/service-catalog.ts) **(nuevo)** — `SERVICE_IDS` + `resolveServiceForPermission()`.
> - [seeder.service.ts](gestion-usuarios/src/utils/seeder.service.ts) — setea `service` al crear y backfillea existentes.
> - [permission.dto.ts](gestion-usuarios/src/roles/dto/permission.dto.ts) + [permissions.service.ts](gestion-usuarios/src/roles/permissions.service.ts) — permisos creados vía API derivan `service` del prefijo (o lo aceptan explícito).

> Prerrequisito de la autorización *pull*. El endpoint interno filtra por `{ rol, serviceId }`, así que el permiso debe saber a qué servicio pertenece.

### Opción elegida: columna explícita `service` en `Permission`
(Alternativa rápida sin migración: derivar el servicio del prefijo del nombre `ZONAS_*` → `zonas-service`. Sirve para demo, es frágil. Documentada abajo como Plan B.)

**1. `src/roles/entities/permission.entity.ts`** — añadir columna.
```ts
@Column({ type: 'varchar', nullable: true })
service!: string; // ej: 'zonas-service', 'tickets-service', 'vehiculos-service', 'usuarios-service'
```

**2. Migración / seeder** — poblar `service` según prefijo:
`ZONAS_* → zonas-service`, `TICKETS_* → tickets-service`, `VEHICULOS_* → vehiculos-service`,
`ASIGNACIONES_* → assignment-service`, `USUARIOS_|ROLES_|ROLEUSERS_|AUDITORIA_ → usuarios-service`.
Actualizar `src/utils/seeder.service.ts` para setear `service` al crear cada permiso.

**Catálogo de `serviceId`** (constante compartida — usar el mismo string en consumidor y en la BD):
| serviceId | Consumidor | Prefijos de permiso |
|---|---|---|
| `zonas-service` | ModuloZonas | `ZONAS_*` |
| `tickets-service` | ticket-service | `TICKETS_*` |
| `vehiculos-service` | VehiclesNPM | `VEHICULOS_*` |
| `assignment-service` | assignment-service | `ASIGNACIONES_*` |
| `usuarios-service` | gestion-usuarios | `USUARIOS_*`,`ROLES_*`,`ROLEUSERS_*`,`AUDITORIA_*` |

---

# FASE 3 — Cambio B (emisor): endpoint interno de permisos + quitar del token  ✅ COMPLETADA

> **Verificada el 2026-07-24.** Endpoint interno + guard + eventos RabbitMQ funcionando.
>
> **Endpoint interno** (consumido directo en la red docker, NO vía Kong):
> `POST http://gestion-usuarios:3001/api/usuarios/internal/role-permissions/resolve`
> Body `{ role, serviceId }` → `{ permissions: string[] }`. Header `x-internal-key: <INTERNAL_API_KEY>`.
>
> Pruebas:
> | Caso | Resultado |
> |---|---|
> | sin `x-internal-key` / clave incorrecta | **401** ✔ |
> | `{ADMIN, zonas-service}` | `[ZONAS_CREATE, READ, UPDATE, DELETE]` ✔ |
> | `{RECAUDADOR, tickets-service}` | `[TICKETS_CREATE, READ, UPDATE]` ✔ |
> | `{CLIENTE, zonas-service}` | `[ZONAS_READ]` ✔ |
> | `{ADMIN, tickets-service}` (sin permisos) | `[]` ✔ |
> | rol inexistente | `200 []` (deny-by-default) ✔ |
> | assign/remove permiso | evento `role_permissions.changed` publicado en `authz_exchange` ✔ |
>
> **Decisión de secuencia:** se **mantuvo `permissions` en el token** (no se quitó todavía)
> para no romper los consumidores actuales. Se eliminará al final de la Fase 4, cuando
> todos consuman por pull.
>
> Implementación real:
> - [dto/resolve-permissions.dto.ts](gestion-usuarios/src/roles/dto/resolve-permissions.dto.ts) **(nuevo)**
> - [auth/guards/internal-key.guard.ts](gestion-usuarios/src/auth/guards/internal-key.guard.ts) **(nuevo)** — header `x-internal-key`, fail-closed
> - [roles/authz-events.publisher.ts](gestion-usuarios/src/roles/authz-events.publisher.ts) **(nuevo)** — exchange `topic` `authz_exchange`, routing key `role_permissions.changed`
> - [roles/internal-role-permissions.controller.ts](gestion-usuarios/src/roles/internal-role-permissions.controller.ts) **(nuevo)** — `@ApiExcludeController`, guarded
> - [roles/role-permissions.service.ts](gestion-usuarios/src/roles/role-permissions.service.ts) — `getPermissionsByRoleAndService()` (query con join a rol por nombre) + publish en assign/remove
> - [roles/roles.module.ts](gestion-usuarios/src/roles/roles.module.ts) — registra controller/publisher/guard
> - [.env](.env) + [docker-compose.yml](docker-compose.yml) — `INTERNAL_API_KEY`, `AUTHZ_EXCHANGE`
>
> **Nota de seguridad:** el endpoint es alcanzable por Kong bajo `/api/usuarios/internal/...`
> pero queda protegido por `InternalKeyGuard` (fail-closed) + la validación JWT de Kong.
> Endurecimiento opcional: bloquear explícitamente `^/api/usuarios/internal/` en `kong.yml`.

### Backend — `gestion-usuarios`

**1. `src/roles/role-permissions.service.ts`** — nuevo método.
```ts
// Devuelve string[] de permisos activos de un rol, filtrados por servicio
async getPermissionsByRoleAndService(roleName: string, serviceId: string): Promise<string[]> {
  const role = await this.rolesService.findByName(roleName); // usar helper existente
  const rps = await this.rolePermissionRepository.find({
    where: { id_role: role.id, active: true, permission: { active: true, service: serviceId } },
    relations: { permission: true },
  });
  return rps.map(rp => rp.permission.name);
}
```

**2. `src/roles/role-permissions.controller.ts`** — endpoint interno.
```ts
// POST /internal/role-permissions/resolve  { role, serviceId } -> { permissions: string[] }
// Protegerlo: solo red interna. Opciones:
//   (a) header secreto compartido X-Internal-Key (env INTERNAL_API_KEY) validado por un guard.
//   (b) restringir la ruta en Kong para que NO sea expuesta al exterior.
// Recomendado: (a) + (b).
```
> Crear `InternalKeyGuard` que compare `req.headers['x-internal-key']` con `process.env.INTERNAL_API_KEY`.

**3. `src/auth/auth.service.ts`** — quitar `permissions` del payload (ya no viajan en el token). El access queda con `role` únicamente.

**4. Eventos de invalidación** — al asignar/quitar permiso o desactivar rol, publicar evento.
- `role-permissions.service.ts` (`assignPermission`/`removePermission`) y `roles.events.ts`: publicar por RabbitMQ (reusar `event-publisher.ts`) un mensaje:
```jsonc
{ "event": "role_permissions.changed", "role": "ADMIN", "service": "zonas-service" }
```
Exchange sugerido: `authz.events` (fanout) para que todos los consumidores lo reciban.

---

# FASE 4 — Cambio B (consumidores): pull + caché + invalidación

> Aplicar a **cada** consumidor: `assignment-service`, `ticket-service`, `VehiclesNPM/vehiculos`, `ModuloZonas`.

## ✅ COMPLETADA — verificada el 2026-07-24

Los 4 consumidores dejaron de leer `x-user-permissions` y ahora **obtienen el rol y hacen pull**
de sus permisos (por servicio) al endpoint interno, con caché en memoria (TTL 5 min) e
invalidación por evento RabbitMQ (`authz_exchange` / `role_permissions.changed`).

| Consumidor | Stack | serviceId | Fuente del rol | Verificación |
|---|---|---|---|---|
| assignment-service | NestJS | `assignment-service` | claim `role` del JWT | **Test definitivo** ✔ |
| vehiculos | NestJS | `vehiculos-service` | claim `role` del JWT | Smoke (ADMIN→200) ✔ |
| ticket-service | Python/FastAPI | `tickets-service` | header `X-User-Roles` | RECAUDADOR→404 / ADMIN→403 ✔ |
| zonas (ModuloZonas) | Java/Spring | `zonas-service` | claim `role` del JWT | **Test definitivo** ✔ |

**Test definitivo** (assignment y zonas): con un token ADMIN se llama al endpoint (200, cache miss→pull);
se **quita** el permiso del rol vía API (evento de invalidación); con el **mismo token** (que aún
embebe el permiso) la llamada da **403**. Esto prueba que el backend decide por *pull* (BD), no por
*push* (token), y que la invalidación funciona sin esperar el TTL. Al re-asignar, vuelve a 200.

### Gotchas encontrados durante la implementación
- **ticket-service**: `RequirePermissions` es dependencia FastAPI `async`; el rol se toma del header
  `X-User-Roles` que inyecta Kong (no del claim, porque la dependencia no decodifica el JWT).
- **ModuloZonas (Spring)**: el proyecto tiene un `Jackson2MessageConverter` global (del audit) que
  rompía el `@RabbitListener`. Solución: el listener recibe `org.springframework.amqp.core.Message`
  crudo y parsea `getBody()` con `ObjectMapper`, evitando el convertidor. El converter de authorities
  del `JwtAuthenticationConverter` lee `role` y llama a `PermissionsCacheService` (cachea el pull).

### Decisión: se MANTIENE `permissions` en el token (no se elimina)
El plan preveía quitar `permissions` del token al terminar la Fase 4. **No se hizo**, porque el
**frontend** usa `permissions` del token para *UX* (`hasPermission()` en `AuthContext.tsx`: mostrar/ocultar
botones). Decisión de diseño: el token conserva `permissions` como **hint de UX del cliente**, pero el
**backend ya no confía en él** — autoriza por *pull* (probado por el test definitivo). La frontera de
seguridad es el backend; el claim del token es solo conveniencia de UI.

### Archivos por consumidor
- **assignment-service** / **vehiculos** (NestJS): `auth/permissions-cache.service.ts` (nuevo, pull+caché+listener amqp),
  `auth/guards/permissions.guard.ts` (async pull), `auth/strategies/jwt.strategy.ts` (expone `role`), `auth/auth.module.ts`.
- **ticket-service** (Python): `app/core/permissions_cache.py` (nuevo), `app/core/dependencies.py` (`RequirePermissions` pull),
  `app/core/config.py` (settings), `app/main.py` (lifespan start/stop consumer).
- **zonas** (Java): `infrastructure/security/PermissionsCacheService.java` (nuevo, RestClient + `@RabbitListener`),
  `infrastructure/security/SecurityConfig.java` (authorities desde `role` vía pull), `application.yaml` (`app.authz`).
- **infra**: `docker-compose.yml` — a cada consumidor: `USUARIOS_INTERNAL_URL`, `INTERNAL_API_KEY`, `AUTHZ_EXCHANGE`.

---

### (Referencia) Patrón NestJS original

### Patrón NestJS (ejemplo: `assignment-service`)

**1. `src/auth/permissions-cache.service.ts`** (nuevo)
```ts
@Injectable()
export class PermissionsCacheService {
  private cache = new Map<string, { perms: string[]; exp: number }>(); // key = role
  private readonly TTL = 5 * 60_000;
  private readonly SERVICE_ID = 'assignment-service';

  constructor(private http: HttpService, private config: ConfigService) {}

  async getPermissions(role: string): Promise<string[]> {
    const hit = this.cache.get(role);
    if (hit && hit.exp > Date.now()) return hit.perms;           // cache hit

    const { data } = await firstValueFrom(this.http.post(       // cache miss -> pull
      `${this.config.get('USUARIOS_INTERNAL_URL')}/internal/role-permissions/resolve`,
      { role, serviceId: this.SERVICE_ID },
      { headers: { 'x-internal-key': this.config.get('INTERNAL_API_KEY') } },
    ));
    this.cache.set(role, { perms: data.permissions, exp: Date.now() + this.TTL });
    return data.permissions;
  }

  invalidate(role: string) { this.cache.delete(role); }
}
```

**2. `src/auth/guards/permissions.guard.ts`** — pasar de *push* a *pull* (async).
```ts
async canActivate(ctx: ExecutionContext): Promise<boolean> {
  const required = this.reflector.get<string[]>('permissions', ctx.getHandler());
  if (!required) return true;
  const req = ctx.switchToHttp().getRequest();
  const role = req.user?.role;                                   // del JWT (rol único)
  if (!role) throw new ForbiddenException('Token sin rol');
  const userPerms = await this.cacheService.getPermissions(role);// <- pull + caché
  if (!required.some(p => userPerms.includes(p)))
    throw new ForbiddenException(`Faltan permisos. Requeridos: ${required.join(', ')}`);
  return true;
}
```
> Eliminar la dependencia del header `x-user-permissions`.

**3. `src/auth/strategies/jwt.strategy.ts`** — exponer `role` en `validate()` (ya no `permissions`).

**4. Listener de invalidación** (RabbitMQ) — consumir `authz.events`:
```ts
// on 'role_permissions.changed' con service === SERVICE_ID (o cualquiera):
//    permissionsCache.invalidate(msg.role)
```
> Reusar el patrón de conexión amqp de `gestion-usuarios/src/audit/event-publisher.ts`.

**5. `src/auth/auth.module.ts`** — registrar `PermissionsCacheService` (ya está `HttpModule`).

**6. Variables de entorno** (por consumidor, en `.env` / `docker-compose.yml`):
```
USUARIOS_INTERNAL_URL=http://gestion-usuarios:3000   # red interna docker/k8s, NO vía Kong
INTERNAL_API_KEY=<secreto-compartido>
```

### Pruebas Fase 4
- 1ª petición de un rol → hay llamada HTTP a `gestion-usuarios` (log). 2ª petición → **sin** llamada (cache hit).
- Cambiar un permiso del rol → evento publicado → siguiente petición refleja el cambio (cache invalidada).
- Permiso faltante → 403. Rol sin permisos para el servicio → 403.

---

## Orden de ejecución recomendado

1. **Fase 1** (A) completa y probada → entregable independiente.
2. **Fase 2** (modelo `service`) + seeder/migración.
3. **Fase 3** (endpoint interno + eventos) — mantener `permissions` en el token temporalmente para no romper consumidores.
4. **Fase 4** consumidor por consumidor. ✅ Hecho. **Nota:** finalmente NO se quitó `permissions`
   del token (lo usa el frontend para UX); ver la decisión documentada en la Fase 4. El backend ya
   no lo usa: autoriza por pull.

## Checklist de riesgos
- [ ] Guard async: confirmar que `PermissionsGuard` async funciona con el orden de guards (`JwtAuthGuard` antes).
- [ ] `refreshTokens()` NO debe reabrir selección de rol (conservar `role` del refresh).
- [ ] Endpoint interno **no** expuesto por Kong al exterior (`kong.yml`).
- [ ] `INTERNAL_API_KEY` fuera del repo (usar `.env`, no commitear).
- [ ] Fallback si `gestion-usuarios` no responde en el pull: definir política (denegar por defecto = seguro).
- [ ] Migrar/actualizar la colección Postman y el `seed_mock_data.py` con el nuevo flujo.

## Archivos afectados (resumen)
**gestion-usuarios**: `auth.module.ts`, `auth.service.ts`, `auth.controller.ts`, `auth/dto/select-role.dto.ts` (nuevo), `auth/guards/{jwt-auth,pre-auth}.guard.ts`, `auth/strategies/jwt.strategy.ts`, `auth/guards/internal-key.guard.ts` (nuevo), `roles/entities/permission.entity.ts`, `roles/role-permissions.service.ts`, `roles/role-permissions.controller.ts`, `roles/roles.events.ts`, `utils/seeder.service.ts`.
**cada consumidor**: `auth/permissions-cache.service.ts` (nuevo), `auth/guards/permissions.guard.ts`, `auth/strategies/jwt.strategy.ts`, `auth/auth.module.ts`, listener RabbitMQ, `.env`.
**parking-frontend**: `api/index.ts`, `context/AuthContext.tsx`, `pages/RoleSelectionPage.tsx` (nuevo), router.
**infra**: `docker-compose.yml`, `kong.yml`, colección Postman, `seed_mock_data.py`.
