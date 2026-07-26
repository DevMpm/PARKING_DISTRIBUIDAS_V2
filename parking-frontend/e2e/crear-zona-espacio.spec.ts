import { test, expect } from '@playwright/test';
import { USER, loginUI } from './helpers';

/**
 * E2E: flujo de crear ZONA y luego un ESPACIO dentro de ella, por la UI,
 * como ADMIN (rol con permiso ZONAS_CREATE).
 */
test('crear zona y espacio', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const zonaName = `E2E Zona ${suffix}`;

  await loginUI(page, USER.username, USER.password, 'ADMIN');

  // Ir a Zonas & Espacios
  await page.getByRole('link', { name: 'Zonas & Espacios' }).click();
  await expect(page.getByRole('heading', { name: 'Zonas & Espacios' })).toBeVisible();

  // --- Crear zona ---
  await page.getByRole('button', { name: '+ Zona' }).click();
  const zonaModal = page.locator('.modal');
  await expect(zonaModal.getByRole('heading', { name: 'Crear Zona' })).toBeVisible();
  await zonaModal.locator('.form-group').filter({ hasText: 'Nombre' }).locator('input').fill(zonaName);
  await zonaModal.locator('.form-group').filter({ hasText: 'Capacidad' }).locator('input').fill('4');
  await zonaModal.getByRole('button', { name: 'Crear Zona' }).click();

  // La tarjeta de la zona nueva aparece
  const zonaCard = page.locator('.card').filter({ hasText: zonaName });
  await expect(zonaCard).toBeVisible();

  // --- Entrar a la zona y crear un espacio ---
  await zonaCard.click();
  await expect(page.getByText(`Viendo: ${zonaName}`)).toBeVisible();

  await page.getByRole('button', { name: '+ Espacio' }).click();
  const espacioModal = page.locator('.modal');
  await expect(espacioModal.getByRole('heading', { name: 'Crear Espacio' })).toBeVisible();
  // Tipo por defecto = AUTO; solo confirmamos
  await espacioModal.getByRole('button', { name: 'Crear Espacio' }).click();

  // El contador de espacios de la zona pasa a (1) y aparece un slot
  await expect(page.getByText(`Espacios de ${zonaName} (1)`)).toBeVisible();
  await expect(page.locator('.espacio-slot')).toHaveCount(1);
  await expect(page.locator('.espacio-slot').first()).toContainText('DISPONIBLE');
});
