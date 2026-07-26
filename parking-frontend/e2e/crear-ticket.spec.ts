import { test, expect } from '@playwright/test';
import {
  USER,
  loginUI,
  apiLogin,
  apiGetPersonaId,
  apiCreateZona,
  apiCreateEspacio,
  apiEnsureVehiculoAuto,
} from './helpers';

/**
 * E2E: flujo de crear un TICKET por la UI, como RECAUDADOR (permiso TICKETS_CREATE).
 *
 * Arrange (por API, con rol ADMIN): una zona con un espacio AUTO disponible y un
 * vehículo Auto con propietario. Act/Assert (por UI, como RECAUDADOR): generar el
 * ticket y verificar que aparece en la lista de activos.
 */
test('crear ticket', async ({ page, request }) => {
  const suffix = Date.now().toString().slice(-4);
  const placa = `PWT-${suffix}`;

  // --- Arrange (API) ---
  const adminToken = await apiLogin(request, USER.username, USER.password, 'ADMIN');
  const personaId = await apiGetPersonaId(request, adminToken, USER.dni);
  const zona = await apiCreateZona(request, adminToken, `E2E ZonaTck ${suffix}`, 'REGULAR', 3);
  const espacio = await apiCreateEspacio(request, adminToken, zona.id, 'AUTO');
  await apiEnsureVehiculoAuto(request, adminToken, placa, personaId);

  // --- Act (UI, como RECAUDADOR) ---
  await loginUI(page, USER.username, USER.password, 'RECAUDADOR');
  await page.getByRole('link', { name: 'Tickets' }).click();
  await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();

  await page.getByRole('button', { name: '+ Nuevo Ticket' }).click();
  const modal = page.locator('.modal');

  // Modo formulario -> seleccionar el espacio creado por su id, y la placa
  await modal.getByRole('button', { name: 'Formulario' }).click();
  const select = modal.locator('select');
  // Espera a que el espacio recién creado esté disponible en el desplegable
  await select.locator(`option[value="${espacio.id}"]`).waitFor({ state: 'attached', timeout: 15_000 });
  await select.selectOption(espacio.id);
  await expect(select).toHaveValue(espacio.id); // confirma que quedó seleccionado
  await modal.getByPlaceholder('ABC-1234').fill(placa);

  // Genera el ticket. La cadena síncrona del backend (ticket -> zonas/vehículos vía
  // Kong) puede dar 502 transitorios bajo carga; reintentamos la acción con backoff.
  // Al fallar, el modal sigue abierto con el espacio libre, así que reintentar es seguro.
  await expect(async () => {
    await modal.getByRole('button', { name: 'Generar Ticket' }).click();
    await expect(modal).toBeHidden({ timeout: 8_000 });
  }).toPass({ timeout: 60_000, intervals: [1_500, 3_000, 5_000] });

  // --- Assert ---
  // El ticket aparece en la tabla de activos con la placa y estado ACTIVO.
  const filaTicket = page.locator('table tbody tr').filter({ hasText: placa });
  await expect(filaTicket).toBeVisible();
  await expect(filaTicket).toContainText('ACTIVO');
});
