import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

// Se ejecuta una sola vez, en el proceso principal de Jest, antes de correr
// cualquier archivo *.e2e-spec.ts. globalSetup y globalTeardown corren en el
// mismo proceso Node, así que guardamos la referencia en `globalThis` para
// poder detener el contenedor desde testcontainers-teardown.ts.
export default async function globalSetup(): Promise<void> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  )
    .withDatabase('parqueadero_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  process.env.TEST_DB_HOST = container.getHost();
  process.env.TEST_DB_PORT = String(container.getMappedPort(5432));
  process.env.TEST_DB_USER = container.getUsername();
  process.env.TEST_DB_PASSWORD = container.getPassword();
  process.env.TEST_DB_NAME = container.getDatabase();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getMappedPort(5432));
  process.env.DB_USUARIO = container.getUsername();
  process.env.DB_CONTRASENA = container.getPassword();
  process.env.DB_NOMBRE = container.getDatabase();
  process.env.RABBITMQ_HOST = 'localhost';
  process.env.RABBITMQ_PORT = '5672';
  process.env.RABBITMQ_USER = 'guest';
  process.env.RABBITMQ_PASSWORD = 'guest';

  (globalThis as any).__PG_CONTAINER__ = container;

  // eslint-disable-next-line no-console
  console.log(
    `[testcontainers] Postgres de pruebas arriba en ${process.env.TEST_DB_HOST}:${process.env.TEST_DB_PORT}`,
  );
}