package ec.edu.espe.zonas.setup;
 
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
 
/**
 * Clase base para pruebas de integración/sociables.
 *
 * El contenedor se declara como campo estático y se arranca una sola vez en
 * el bloque estático: como es estático en la clase base, todas las subclases
 * comparten la MISMA instancia (una sola vez por ejecución de la suite, no
 * una vez por clase). No se llama a .stop() explícitamente: el "Ryuk"
 * (contenedor reaper de Testcontainers) lo limpia automáticamente al
 * terminar la JVM.
 *
 * Nota: aquí usamos @DynamicPropertySource en vez de @ServiceConnection
 * porque @ServiceConnection está pensado para el ciclo de vida por-clase de
 * @Testcontainers/@Container. Con el patrón singleton controlamos el
 * arranque manualmente, así que exponemos las propiedades nosotros mismos.
 */
public abstract class MockDatasource {
 
    protected static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");
 
    static {
        POSTGRES.start();
    }
 
    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}