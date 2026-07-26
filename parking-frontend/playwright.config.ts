import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas E2E (10% de la pirámide). Requieren el stack completo levantado
 * (docker compose up) y el front en http://localhost:5173.
 *
 * Ejecutar:  npm run e2e        (o: npx playwright test)
 *            npm run e2e:ui     (modo interactivo)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Estas pruebas mutan estado del backend compartido -> serial, sin paralelismo.
  fullyParallel: false,
  workers: 1,
  // E2E sobre un stack distribuido real: se permiten reintentos ante hipos
  // transitorios (p.ej. arranque frío de un servicio, timeouts esporádicos).
  retries: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Reusa el dev server si ya está corriendo; si no, lo levanta.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
