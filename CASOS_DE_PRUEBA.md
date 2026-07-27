# Matriz y Especificación de Casos de Prueba (Test Cases)

Este documento centraliza la especificación formal de los **Casos de Prueba (CP)** diseñados para validar cada uno de los microservicios, reglas de negocio, autorizaciones RBAC y flujos operacionales del **Sistema de Gestión de Parqueaderos Distribuido**.

---

## 1. Estructura de Especificación de un Caso de Prueba

Cada caso de prueba en el sistema está documentado bajo un estándar riguroso de aseguramiento de calidad (QA) que define:
- **Identificador (ID):** Código único de traza (Ej. `CP9.1`, `CP1_1`).
- **Título / Objetivo:** Descripción concisa del comportamiento o regla a validar.
- **Precondiciones:** Estado inicial requerido de la base de datos, roles JWT o configuraciones previas.
- **Entrada / Acción:** Petición HTTP (Método, URL, Headers, Body JSON) o interacción en UI.
- **Criterios de Verificación (Resultado Esperado):**
  1. Código de estado HTTP exacto (200 OK, 201 Created, 400 Bad Request, 403 Forbidden, 404 Not Found, etc.).
  2. Estructura y coherencia del payload o mensaje de respuesta.
  3. Efecto secundario esperado (Ej. Evento emitido a RabbitMQ, registro insertado en tabla de auditoría).

---

## 2. Inventario de Suites de Pruebas por Módulo

A continuación, se presentan las suites de casos de prueba organizadas por dominio funcional con enlaces directos a sus especificaciones completas detalladas en el directorio `pruebas_unitarias/`:

| Módulo / Microservicio | Archivo de Especificación | Alcance y Cobertura Principal |
| :--- | :--- | :--- |
| **Autenticación y Usuarios** | [cp_usuarios.txt](./pruebas_unitarias/cp_usuarios.txt) | Login JWT, validación de credenciales, bloqueo por reintentos, CRUD de usuarios e inhabilitación. |
| **Gestión de Roles** | [cp_roles.txt](./pruebas_unitarias/cp_roles.txt) | Creación de roles, jerarquías, roles del sistema inmutables (`ROOT`, `ADMIN`, `USER`). |
| **Gestión de Permisos** | [cp_permissions.txt](./pruebas_unitarias/cp_permissions.txt) | Catálogo granular de permisos, validación de unicidad de claves y descripciones. |
| **Asignación Roles-Usuarios** | [cp_roleusers.txt](./pruebas_unitarias/cp_roleusers.txt) | Vinculación y desvinculación de roles a cuentas de usuario, prevención de remoción al último root. |
| **Asignación Roles-Permisos** | [cp_rolepermissions.txt](./pruebas_unitarias/cp_rolepermissions.txt) | Mapeo dinámico de privilegios a roles, re-evaluación en tiempo de ejecución. |
| **Propietarios y Personas** | [cp_personas.txt](./pruebas_unitarias/cp_personas.txt) | Registro de personas naturales y jurídicas, validación de DNI/RUC y unicidad de correo. |
| **Vehículos y Categorías** | [cp_vehículos.txt](./pruebas_unitarias/cp_vehículos.txt) | Validación de formato de placas, clasificación (Automóvil, Motocicleta, Institucional), asociación a propietarios. |
| **Zonas de Parqueo** | [cp_zonas.txt](./pruebas_unitarias/cp_zonas.txt) | Creación de zonas (Cubierta, Descubierta, VIP), límites de capacidad, modificación de tarifas y horarios. |
| **Espacios Individuales** | [cp_espacios.txt](./pruebas_unitarias/cp_espacios.txt) | Generación automática y manual de espacios, cambio de estado (Libre, Ocupado, Mantenimiento). |
| **Servicio de Tickets (Tarifas)** | [cp_tickets](./pruebas_unitarias/cp_tickets) | Ingreso de vehículos, cálculo de tarifa por fracción/hora, vehículos institucionales (tarifa $0.00), anulación y salida. |
| **Asignaciones de Parqueo** | [cp_asignaciones](./pruebas_unitarias/cp_asignaciones) | Asignación fija de espacios a autoridades o docentes, validación de conflictos de reserva. |
| **Auditoria Centralizada** | [cp_auditoria](./pruebas_unitarias/cp_auditoria) | Registro inmutable de eventos críticos, traza de IP, usuario y timestamp, consultas filtradas. |
| **API Gateway & Seguridad** | [cp_gateway](./pruebas_unitarias/cp_gateway) | Enrutamiento inverso en Kong, validación de API Keys internas, rechazo de peticiones externas a puertos privados. |

---

## 3. Ejemplos Destacados de Casos de Prueba Críticos

### 🎟️ Módulo de Tickets: Emisión de Ticket para Vehículo Institucional (CP1_5)
* **Objetivo:** Verificar que el ingreso de un vehículo catalogado como "Institucional" genere un ticket válido con exención de pago.
* **Precondición:** Vehículo con placa `INST-001` registrado como tipo `INSTITUCIONAL` y un espacio desocupado disponible.
* **Entrada:** `POST /api/v1/tickets` con payload `{ "placa": "INST-001", "id_espacio": "<uuid>" }`.
* **Resultado Esperado:**
  1. HTTP Status `201 Created`.
  2. Estado del ticket `ACTIVO` y tarifa aplicada `0.00`.
  3. El estado del espacio en `ms-core` cambia asíncronamente a `OCUPADO`.
  4. Emisión exitosa del evento `ticket.creado` a RabbitMQ para auditoría.

### 🛡️ Módulo de Seguridad: Intento de Acceso No Autorizado a Recurso Protegido (CP9.2)
* **Objetivo:** Asegurar el cumplimiento estricto del control de acceso basado en roles (RBAC).
* **Precondición:** Usuario autenticado con rol estándar `USER` (sin permiso `USUARIOS_READ`).
* **Entrada:** `GET /users` adjuntando el token Bearer en el encabezado `Authorization`.
* **Resultado Esperado:**
  1. HTTP Status `403 Forbidden`.
  2. Respuesta JSON: `{ "error": "Forbidden", "message": "No cuenta con los permisos necesarios para realizar esta acción." }`.
  3. Generación de evento de auditoría de alerta por intento de acceso denegado.

---

## 4. Enlaces Relacionados
* [Documento General y Estrategia de Pruebas](./DOCUMENTO_DE_PRUEBAS.md)
* [Arquitectura y Guía Principal del Sistema](./README.md)
* [Guía de Despliegue en Kubernetes](./GUIA_KUBERNETES.md)
