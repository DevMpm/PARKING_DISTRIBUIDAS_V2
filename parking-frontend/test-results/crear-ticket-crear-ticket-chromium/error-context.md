# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: crear-ticket.spec.ts >> crear ticket
- Location: e2e\crear-ticket.spec.ts:19:1

# Error details

```
Error: expect(locator).toBeHidden() failed

Locator:  locator('.modal')
Expected: hidden
Received: visible
Timeout:  8000ms

Call log:
  - Expect "toBeHidden" with timeout 8000ms
  - waiting for locator('.modal')
    19 × locator resolved to <div class="modal">…</div>
       - unexpected value "visible"


Call Log:
- Test timeout of 60000ms exceeded
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: ParkingDS
      - button "◀" [ref=e8] [cursor=pointer]
    - navigation [ref=e9]:
      - link "📊 Dashboard" [ref=e10] [cursor=pointer]:
        - /url: /dashboard
        - generic [ref=e11]: 📊
        - generic [ref=e12]: Dashboard
      - link "🅿️ Zonas & Espacios" [ref=e13] [cursor=pointer]:
        - /url: /zonas
        - generic [ref=e14]: 🅿️
        - generic [ref=e15]: Zonas & Espacios
      - link "🎫 Tickets" [ref=e16] [cursor=pointer]:
        - /url: /tickets
        - generic [ref=e17]: 🎫
        - generic [ref=e18]: Tickets
      - link "🚗 Vehículos" [ref=e19] [cursor=pointer]:
        - /url: /vehiculos
        - generic [ref=e20]: 🚗
        - generic [ref=e21]: Vehículos
    - generic [ref=e22]:
      - generic [ref=e23]:
        - generic [ref=e24]: M
        - generic [ref=e25]:
          - generic [ref=e26]: mrol
          - generic [ref=e27]: RECAUDADOR
      - button "🚪 Salir" [ref=e28] [cursor=pointer]:
        - generic [ref=e29]: 🚪
        - generic [ref=e30]: Salir
  - generic [ref=e31]:
    - button "← Regresar" [ref=e33] [cursor=pointer]:
      - generic [ref=e34]: ←
      - text: Regresar
    - generic [ref=e36]:
      - generic [ref=e37]:
        - generic [ref=e38]:
          - heading "Tickets" [level=1] [ref=e39]
          - paragraph [ref=e40]: Gestión de tickets de estacionamiento
        - generic [ref=e41]:
          - button "🔍 Buscar" [ref=e42] [cursor=pointer]
          - button "+ Nuevo Ticket" [ref=e43] [cursor=pointer]
      - generic [ref=e44]:
        - generic [ref=e45]:
          - generic [ref=e46]: ✅
          - generic [ref=e47]:
            - generic [ref=e48]: "35"
            - generic [ref=e49]: Disponibles
        - generic [ref=e50]:
          - generic [ref=e51]: 🚗
          - generic [ref=e52]:
            - generic [ref=e53]: "9"
            - generic [ref=e54]: Ocupados
        - generic [ref=e55]:
          - generic [ref=e56]: 🎫
          - generic [ref=e57]:
            - generic [ref=e58]: "8"
            - generic [ref=e59]: Tickets Activos
        - generic [ref=e60]:
          - generic [ref=e61]: 💰
          - generic [ref=e62]:
            - generic [ref=e63]: $0.00
            - generic [ref=e64]: Recaudado
      - generic [ref=e65]:
        - generic [ref=e66]: Tickets activos (8)
        - table [ref=e69]:
          - rowgroup [ref=e70]:
            - row [ref=e71]:
              - columnheader "Código" [ref=e72]
              - columnheader "Placa" [ref=e73]
              - columnheader "Usuario" [ref=e74]
              - columnheader "Categoría" [ref=e75]
              - columnheader "Ingreso" [ref=e76]
              - columnheader "Salida" [ref=e77]
              - columnheader "Estado" [ref=e78]
              - columnheader "Valor" [ref=e79]
              - columnheader "Acciones" [ref=e80]
          - rowgroup [ref=e81]:
            - row [ref=e82]:
              - cell "TCK-20260725-6345D7" [ref=e83]
              - cell "PWT-0237" [ref=e84]
              - cell "✓ Registrado" [ref=e86]
              - cell "AUTO_CAMIONETA ESTANDAR" [ref=e88]:
                - generic [ref=e89]: AUTO_CAMIONETA
                - generic [ref=e90]: ESTANDAR
              - cell "25/7/2026, 5:07:01 p. m." [ref=e91]
              - cell "—" [ref=e92]
              - cell "ACTIVO" [ref=e93]
              - cell "—" [ref=e95]
              - cell [ref=e96]:
                - generic [ref=e97]:
                  - button "💰 Pagar" [ref=e98] [cursor=pointer]
                  - button "✕ Anular" [ref=e99] [cursor=pointer]
            - row [ref=e100]:
              - cell "TCK-20260725-25FEC3" [ref=e101]
              - cell "PWT-3061" [ref=e102]
              - cell "✓ Registrado" [ref=e104]
              - cell "AUTO_CAMIONETA ESTANDAR" [ref=e106]:
                - generic [ref=e107]: AUTO_CAMIONETA
                - generic [ref=e108]: ESTANDAR
              - cell "25/7/2026, 5:01:32 p. m." [ref=e109]
              - cell "—" [ref=e110]
              - cell "ACTIVO" [ref=e111]
              - cell "—" [ref=e113]
              - cell [ref=e114]:
                - generic [ref=e115]:
                  - button "💰 Pagar" [ref=e116] [cursor=pointer]
                  - button "✕ Anular" [ref=e117] [cursor=pointer]
            - row [ref=e118]:
              - cell "TCK-20260725-6D45E7" [ref=e119]
              - cell "PWT-6366" [ref=e120]
              - cell "✓ Registrado" [ref=e122]
              - cell "AUTO_CAMIONETA ESTANDAR" [ref=e124]:
                - generic [ref=e125]: AUTO_CAMIONETA
                - generic [ref=e126]: ESTANDAR
              - cell "25/7/2026, 4:56:26 p. m." [ref=e127]
              - cell "—" [ref=e128]
              - cell "ACTIVO" [ref=e129]
              - cell "—" [ref=e131]
              - cell [ref=e132]:
                - generic [ref=e133]:
                  - button "💰 Pagar" [ref=e134] [cursor=pointer]
                  - button "✕ Anular" [ref=e135] [cursor=pointer]
            - row [ref=e136]:
              - cell "TCK-20260725-4764C3" [ref=e137]
              - cell "PWT-9913" [ref=e138]
              - cell "✓ Registrado" [ref=e140]
              - cell "AUTO_CAMIONETA ESTANDAR" [ref=e142]:
                - generic [ref=e143]: AUTO_CAMIONETA
                - generic [ref=e144]: ESTANDAR
              - cell "25/7/2026, 4:50:43 p. m." [ref=e145]
              - cell "—" [ref=e146]
              - cell "ACTIVO" [ref=e147]
              - cell "—" [ref=e149]
              - cell [ref=e150]:
                - generic [ref=e151]:
                  - button "💰 Pagar" [ref=e152] [cursor=pointer]
                  - button "✕ Anular" [ref=e153] [cursor=pointer]
            - row [ref=e154]:
              - cell "TCK-20260725-89249C" [ref=e155]
              - cell "PWT-0401" [ref=e156]
              - cell "✓ Registrado" [ref=e158]
              - cell "AUTO_CAMIONETA ESTANDAR" [ref=e160]:
                - generic [ref=e161]: AUTO_CAMIONETA
                - generic [ref=e162]: ESTANDAR
              - cell "25/7/2026, 4:39:00 p. m." [ref=e163]
              - cell "—" [ref=e164]
              - cell "ACTIVO" [ref=e165]
              - cell "—" [ref=e167]
              - cell [ref=e168]:
                - generic [ref=e169]:
                  - button "💰 Pagar" [ref=e170] [cursor=pointer]
                  - button "✕ Anular" [ref=e171] [cursor=pointer]
            - row [ref=e172]:
              - cell "TCK-20260725-F766F9" [ref=e173]
              - cell "PWT-5714" [ref=e174]
              - cell "✓ Registrado" [ref=e176]
              - cell "AUTO_CAMIONETA ESTANDAR" [ref=e178]:
                - generic [ref=e179]: AUTO_CAMIONETA
                - generic [ref=e180]: ESTANDAR
              - cell "25/7/2026, 4:29:21 p. m." [ref=e181]
              - cell "—" [ref=e182]
              - cell "ACTIVO" [ref=e183]
              - cell "—" [ref=e185]
              - cell [ref=e186]:
                - generic [ref=e187]:
                  - button "💰 Pagar" [ref=e188] [cursor=pointer]
                  - button "✕ Anular" [ref=e189] [cursor=pointer]
            - row [ref=e190]:
              - cell "TCK-20260725-D17129" [ref=e191]
              - cell "PWT-8171" [ref=e192]
              - cell "✓ Registrado" [ref=e194]
              - cell "AUTO_CAMIONETA ESTANDAR" [ref=e196]:
                - generic [ref=e197]: AUTO_CAMIONETA
                - generic [ref=e198]: ESTANDAR
              - cell "25/7/2026, 4:24:14 p. m." [ref=e199]
              - cell "—" [ref=e200]
              - cell "ACTIVO" [ref=e201]
              - cell "—" [ref=e203]
              - cell [ref=e204]:
                - generic [ref=e205]:
                  - button "💰 Pagar" [ref=e206] [cursor=pointer]
                  - button "✕ Anular" [ref=e207] [cursor=pointer]
            - row [ref=e208]:
              - cell "TCK-20260725-A4C218" [ref=e209]
              - cell "PWT-0053" [ref=e210]
              - cell "✓ Registrado" [ref=e212]
              - cell "AUTO_CAMIONETA ESTANDAR" [ref=e214]:
                - generic [ref=e215]: AUTO_CAMIONETA
                - generic [ref=e216]: ESTANDAR
              - cell "25/7/2026, 4:18:34 p. m." [ref=e217]
              - cell "—" [ref=e218]
              - cell "ACTIVO" [ref=e219]
              - cell "—" [ref=e221]
              - cell [ref=e222]:
                - generic [ref=e223]:
                  - button "💰 Pagar" [ref=e224] [cursor=pointer]
                  - button "✕ Anular" [ref=e225] [cursor=pointer]
      - generic [ref=e227]:
        - heading "🎫 Generar Ticket" [level=2] [ref=e228]
        - generic [ref=e229]:
          - button "🗺️ Cuadrícula" [ref=e230] [cursor=pointer]
          - button "📝 Formulario" [ref=e231] [cursor=pointer]
        - generic [ref=e232]:
          - generic [ref=e233]:
            - generic [ref=e234]: Espacio Disponible
            - combobox [ref=e235]:
              - option "Seleccionar espacio..."
              - option "ZONA-REG.-01 — Zona Norte (AUTO)"
              - option "ZONA-REG.-02 — Zona Norte (AUTO)"
              - option "ZONA-REG.-04 — E2E Zona 315454 (AUTO)"
              - option "ZONA-REG.-05 — E2E ZonaTck 5639 (AUTO)"
              - option "ZONA-REG.-06 — E2E Zona 416357 (AUTO)"
              - option "ZONA-REG.-07 — E2E ZonaTck 8063 (AUTO)"
              - option "ZONA-REG.-08 — E2E Zona 624160 (AUTO)"
              - option "ZONA-REG.-10 — E2E Zona 655307 (AUTO)"
              - option "ZONA-REG.-11 — E2E ZonaTck 4402 (AUTO)"
              - option "ZONA-REG.-12 — E2E ZonaTck 5589 (AUTO)"
              - option "ZONA-REG.-14 — E2E Zona 962871 (AUTO)"
              - option "ZONA-REG.-15 — E2E ZonaTck 5130 (AUTO)"
              - option "ZONA-REG.-16 — E2E ZonaTck 5583 (AUTO)"
              - option "ZONA-REG.-17 — E2E ZonaTck 8313 (AUTO)"
              - option "ZONA-REG.-18 — E2E Zona 059604 (AUTO)"
              - option "ZONA-REG.-21 — E2E Zona 541344 (AUTO)"
              - option "ZONA-REG.-22 — E2E ZonaTck 2257 (AUTO)"
              - option "ZONA-REG.-23 — E2E ZonaTck 4734 (AUTO)"
              - option "ZONA-REG.-24 — E2E ZonaTck 5227 (AUTO)"
              - option "ZONA-REG.-25 — E2E Zona 635446 (AUTO)"
              - option "ZONA-REG.-26 — E2E ZonaTck 7949 (AUTO)"
              - option "ZONA-REG.-29 — E2E Zona 587644 (AUTO)"
              - option "ZONA-REG.-30 — E2E ZonaTck 8016 (AUTO)"
              - option "ZONA-REG.-31 — E2E Zona 640937 (AUTO)"
              - option "ZONA-REG.-32 — E2E ZonaTck 8519 (AUTO)"
              - option "ZONA-REG.-33 — E2E Zona 688528 (AUTO)"
              - option "ZONA-REG.-35 — E2E Zona 895707 (AUTO)"
              - option "ZONA-REG.-36 — E2E ZonaTck 2055 (AUTO)"
              - option "ZONA-REG.-37 — E2E Zona 945133 (AUTO)"
              - option "ZONA-REG.-38 — E2E ZonaTck 0219 (AUTO)"
              - option "ZONA-REG.-39 — E2E Zona 013320 (AUTO)"
              - option "ZONA-REG.-40 — E2E ZonaTck 4862 (AUTO)"
              - option "ZONA-REG.-41 — E2E Zona 162734 (AUTO)"
              - option "ZONA-REG.-43 — E2E Zona 223916 (AUTO)"
              - option "ZONA-REG.-44 — E2E ZonaTck 5412 (AUTO)" [selected]
          - generic [ref=e236]:
            - generic [ref=e237]: Placa del Vehículo *
            - textbox "ABC-1234" [ref=e238]: PWT-5412
          - generic [ref=e239]:
            - button "Cancelar" [ref=e240] [cursor=pointer]
            - button "Generar Ticket" [ref=e241] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import {
  3  |   USER,
  4  |   loginUI,
  5  |   apiLogin,
  6  |   apiGetPersonaId,
  7  |   apiCreateZona,
  8  |   apiCreateEspacio,
  9  |   apiEnsureVehiculoAuto,
  10 | } from './helpers';
  11 | 
  12 | /**
  13 |  * E2E: flujo de crear un TICKET por la UI, como RECAUDADOR (permiso TICKETS_CREATE).
  14 |  *
  15 |  * Arrange (por API, con rol ADMIN): una zona con un espacio AUTO disponible y un
  16 |  * vehículo Auto con propietario. Act/Assert (por UI, como RECAUDADOR): generar el
  17 |  * ticket y verificar que aparece en la lista de activos.
  18 |  */
  19 | test('crear ticket', async ({ page, request }) => {
  20 |   const suffix = Date.now().toString().slice(-4);
  21 |   const placa = `PWT-${suffix}`;
  22 | 
  23 |   // --- Arrange (API) ---
  24 |   const adminToken = await apiLogin(request, USER.username, USER.password, 'ADMIN');
  25 |   const personaId = await apiGetPersonaId(request, adminToken, USER.dni);
  26 |   const zona = await apiCreateZona(request, adminToken, `E2E ZonaTck ${suffix}`, 'REGULAR', 3);
  27 |   const espacio = await apiCreateEspacio(request, adminToken, zona.id, 'AUTO');
  28 |   await apiEnsureVehiculoAuto(request, adminToken, placa, personaId);
  29 | 
  30 |   // --- Act (UI, como RECAUDADOR) ---
  31 |   await loginUI(page, USER.username, USER.password, 'RECAUDADOR');
  32 |   await page.getByRole('link', { name: 'Tickets' }).click();
  33 |   await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
  34 | 
  35 |   await page.getByRole('button', { name: '+ Nuevo Ticket' }).click();
  36 |   const modal = page.locator('.modal');
  37 | 
  38 |   // Modo formulario -> seleccionar el espacio creado por su id, y la placa
  39 |   await modal.getByRole('button', { name: 'Formulario' }).click();
  40 |   const select = modal.locator('select');
  41 |   // Espera a que el espacio recién creado esté disponible en el desplegable
  42 |   await select.locator(`option[value="${espacio.id}"]`).waitFor({ state: 'attached', timeout: 15_000 });
  43 |   await select.selectOption(espacio.id);
  44 |   await expect(select).toHaveValue(espacio.id); // confirma que quedó seleccionado
  45 |   await modal.getByPlaceholder('ABC-1234').fill(placa);
  46 | 
  47 |   // Genera el ticket. La cadena síncrona del backend (ticket -> zonas/vehículos vía
  48 |   // Kong) puede dar 502 transitorios bajo carga; reintentamos la acción con backoff.
  49 |   // Al fallar, el modal sigue abierto con el espacio libre, así que reintentar es seguro.
  50 |   await expect(async () => {
  51 |     await modal.getByRole('button', { name: 'Generar Ticket' }).click();
  52 |     await expect(modal).toBeHidden({ timeout: 8_000 });
> 53 |   }).toPass({ timeout: 60_000, intervals: [1_500, 3_000, 5_000] });
     |      ^ Error: expect(locator).toBeHidden() failed
  54 | 
  55 |   // --- Assert ---
  56 |   // El ticket aparece en la tabla de activos con la placa y estado ACTIVO.
  57 |   const filaTicket = page.locator('table tbody tr').filter({ hasText: placa });
  58 |   await expect(filaTicket).toBeVisible();
  59 |   await expect(filaTicket).toContainText('ACTIVO');
  60 | });
  61 | 
```