import { type APIRequestContext, type Page, expect } from '@playwright/test';

// Todo pasa por Kong (puerto 8000). El front usa el proxy de Vite en dev.
export const KONG = 'http://localhost:8000/api';

// Usuario multi-rol sembrado (CLIENTE + ADMIN + RECAUDADOR).
export const USER = { username: 'mrol', password: '1700200015', dni: '1700200015' };

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * Login vía API resolviendo el flujo pre-auth (elige `preferRole` si el usuario
 * tiene varios roles). Se usa para el "Arrange" de las pruebas.
 */
export async function apiLogin(
  request: APIRequestContext,
  username: string,
  password: string,
  preferRole?: string,
): Promise<string> {
  const res = await request.post(`${KONG}/usuarios/auth/login`, { data: { username, password } });
  const body = await res.json();
  if (body.access_token) return body.access_token;
  const role = preferRole && body.roles.includes(preferRole) ? preferRole : body.roles[0];
  const sr = await request.post(`${KONG}/usuarios/auth/select-role`, {
    data: { role },
    headers: auth(body.pre_auth_token),
  });
  return (await sr.json()).access_token;
}

export async function apiGetPersonaId(request: APIRequestContext, token: string, dni: string): Promise<string> {
  const res = await request.get(`${KONG}/usuarios/personas/dni/${dni}`, { headers: auth(token) });
  expect(res.ok(), `getByDni ${dni}`).toBeTruthy();
  return (await res.json()).id;
}

export async function apiCreateZona(
  request: APIRequestContext,
  token: string,
  nombre: string,
  tipo = 'REGULAR',
  capacidad = 5,
): Promise<{ id: string }> {
  const res = await request.post(`${KONG}/v1/zonas/`, { headers: auth(token), data: { nombre, tipo, capacidad } });
  expect(res.ok(), `crear zona: ${await res.text()}`).toBeTruthy();
  return res.json();
}

export async function apiCreateEspacio(
  request: APIRequestContext,
  token: string,
  idZona: string,
  tipo = 'AUTO',
): Promise<{ id: string; codigo: string }> {
  const res = await request.post(`${KONG}/v1/espacios/`, { headers: auth(token), data: { idZona, tipo } });
  expect(res.ok(), `crear espacio: ${await res.text()}`).toBeTruthy();
  return res.json();
}

/**
 * Registra un vehículo Auto con propietario (para que el ticket no viole el
 * NOT NULL de id_usuario). Tolera 409 si la placa ya existe de una corrida previa.
 */
export async function apiEnsureVehiculoAuto(
  request: APIRequestContext,
  token: string,
  placa: string,
  idPropietario: string,
): Promise<void> {
  const res = await request.post(`${KONG}/vehiculos`, {
    headers: auth(token),
    data: {
      tipo: 'Auto',
      idPropietario,
      datos: {
        placa,
        marca: 'TestMarca',
        modelo: 'TestModelo',
        color: 'Blanco',
        anio: 2022,
        clasificacion: 'Gasolina',
        numeroPuertas: 4,
        capacidadMaletero: 400,
      },
    },
  });
  // 201 creado, o 409 si ya existía: ambos son válidos para el arrange.
  expect([200, 201, 409], `crear vehículo: ${await res.text()}`).toContain(res.status());
}

/**
 * Login por la UI resolviendo la pantalla de selección de rol (usuarios multi-rol).
 * Deja la sesión lista en /dashboard.
 */
export async function loginUI(page: Page, username: string, password: string, role: string): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Ingresa tu usuario').fill(username);
  await page.getByPlaceholder('Ingresa tu contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  // Tras el login puede aparecer la selección de rol (multi-rol) o ir directo al
  // dashboard (rol único). Esperamos a que ocurra cualquiera de las dos.
  const roleSelect = page.locator('#role-select');
  const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
  await Promise.race([
    roleSelect.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
    dashboardLink.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
  ]);

  if (await roleSelect.isVisible()) {
    await roleSelect.selectOption(role);
    await page.getByRole('button', { name: 'Continuar' }).click();
  }

  // La app quedó cargada (nav lateral de gestión visible).
  await expect(dashboardLink).toBeVisible();
}
