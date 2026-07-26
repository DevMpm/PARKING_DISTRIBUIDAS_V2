export default async function globalTeardown(): Promise<void> {
  const container = (globalThis as any).__PG_CONTAINER__;
  if (container) {
    await container.stop();
    // eslint-disable-next-line no-console
    console.log('[testcontainers] Postgres de pruebas detenido');
  }
}
 