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
## 2. Inventario completo de Casos de Prueba
Todos los casos de pruebas unitarias ejecutadas se encuentran en el siguiente documento:
#### [Reporte Casos de Prueba](./reporte_pruebas/main.pdf)
---

## 3. Inventario de Suites de Pruebas por Módulo

A continuación, se presentan las suites de casos de prueba organizadas por dominio funcional con enlaces directos a sus especificaciones completas detalladas en el directorio `pruebas_unitarias/`:

| Módulo / Microservicio | Archivo de Especificación | Alcance y Cobertura Principal |
| :--- | :--- | :--- |
| **Usuarios** | [cp_usuarios.txt](./pruebas_unitarias/cp_usuarios.txt) | CRUD completo de usuarios, validación de contraseñas (longitud mínima, obligatoriedad), restricciones de acceso por rol (`ADMIN`/`ROOT` vs `USER`), búsqueda por ID/username e inhabilitación. |
| **Gestión de Roles** | [cp_roles.txt](./pruebas_unitarias/cp_roles.txt) | Creación y administración de roles, jerarquías, validación de nombres únicos y protección de roles del sistema inmutables (`ROOT`, `ADMIN`, `USER`). |
| **Gestión de Permisos** | [cp_permissions.txt](./pruebas_unitarias/cp_permissions.txt) | Catálogo granular de permisos, validación de unicidad de claves (`name`), restricciones de longitud y servicios asociados. |
| **Asignación Roles-Usuarios** | [cp_roleusers.txt](./pruebas_unitarias/cp_roleusers.txt) | Vinculación y desvinculación de roles a cuentas de usuario, prevención de remoción de privilegios críticos al último usuario `ROOT`. |
| **Asignación Roles-Permisos** | [cp_rolepermissions.txt](./pruebas_unitarias/cp_rolepermissions.txt) | Mapeo dinámico de privilegios a roles, asociación y desasociación de permisos granulares. |
| **Propietarios y Personas** | [cp_personas.txt](./pruebas_unitarias/cp_personas.txt) | CRUD de personas físicas/jurídicas, validación rigurosa de formato DNI/RUC, unicidad de correo y estados operativos. |
| **Vehículos y Categorías** | [cp_vehículos.txt](./pruebas_unitarias/cp_vehículos.txt) | Validación de formato de placas, clasificación vehicular (Automóvil, Motocicleta, Camioneta) y control de estado activo/inactivo. |
| **Zonas de Parqueo** | [cp_zonas.txt](./pruebas_unitarias/cp_zonas.txt) | Creación de zonas, límites de capacidad, modificación de tarifas y horarios, filtrado por tipos y disponibilidad de espacios. |
| **Espacios Individuales** | [cp_espacios.txt](./pruebas_unitarias/cp_espacios.txt) | Generación automática y manual de espacios, cambio de estados (Libre, Ocupado, Mantenimiento) y validación de compatibilidad con tipos de vehículos. |
| **Servicio de Tickets (Tarifas)** | [cp_tickets](./pruebas_unitarias/cp_tickets) | Ingreso y salida de vehículos, cálculo de tarifa por fracción/hora, exenciones institucionales, validación de estados y emisión de eventos asíncronos vía RabbitMQ. |
| **Asignaciones de Parqueo** | [cp_asignaciones](./pruebas_unitarias/cp_asignaciones) | Asignación fija de espacios/vehículos a usuarios (autoridades/docentes), prevención de conflictos de reserva activos/inactivos y consulta de flota por propietario. |
| **Auditoria Centralizada** | [cp_auditoria](./pruebas_unitarias/cp_auditoria) | Registro inmutable de eventos críticos (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, SELECT), validación de DTOs (IP, MAC, servicio, entidadId) y consultas filtradas. |
| **API Gateway & Seguridad** | [cp_gateway](./pruebas_unitarias/cp_gateway) | Enrutamiento inverso en Kong, consulta de estado de vehículos, autorización de ingresos con validación de cupo (modo estricto y `permitirSinValidarCupo`) y registro *walk-in*. |

---

## 4. Enlaces Relacionados
* [Documento General y Estrategia de Pruebas](./DOCUMENTO_DE_PRUEBAS.md)
* [Arquitectura y Guía Principal del Sistema](./README.md)
* [Guía de Despliegue en Kubernetes](./GUIA_KUBERNETES.md)
