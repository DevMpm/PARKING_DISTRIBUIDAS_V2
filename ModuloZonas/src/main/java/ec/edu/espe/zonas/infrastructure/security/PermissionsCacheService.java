package ec.edu.espe.zonas.infrastructure.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Autorización PULL para el microservicio de zonas.
 *  - Pide a gestion-usuarios (endpoint interno) los permisos de un rol filtrados
 *    por este servicio, y los cachea en memoria con TTL.
 *  - Escucha eventos 'role_permissions.changed' por RabbitMQ para invalidar la caché.
 */
@Service
public class PermissionsCacheService {

    private static final Logger log = LoggerFactory.getLogger(PermissionsCacheService.class);
    private static final long TTL_MS = 5 * 60_000L;
    private static final String SERVICE_ID = "zonas-service";

    private record CacheEntry(List<String> perms, long exp) {}

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String internalUrl;
    private final String internalKey;

    public PermissionsCacheService(
            ObjectMapper objectMapper,
            @Value("${app.authz.internal-url:http://gestion-usuarios:3001/api/usuarios}") String internalUrl,
            @Value("${app.authz.internal-key:}") String internalKey) {
        this.objectMapper = objectMapper;
        this.internalUrl = internalUrl.replaceAll("/+$", "");
        this.internalKey = internalKey;
        this.restClient = RestClient.create();
    }

    /** Devuelve los permisos del rol para este servicio (cacheados). [] ante fallo. */
    @SuppressWarnings("unchecked")
    public List<String> getPermissions(String role) {
        CacheEntry entry = cache.get(role);
        if (entry != null && entry.exp() > System.currentTimeMillis()) {
            return entry.perms();
        }

        try {
            Map<String, Object> body = restClient.post()
                    .uri(internalUrl + "/internal/role-permissions/resolve")
                    .header("x-internal-key", internalKey)
                    .header("Content-Type", "application/json")
                    .body(Map.of("role", role, "serviceId", SERVICE_ID))
                    .retrieve()
                    .body(Map.class);

            List<String> perms = body != null && body.get("permissions") != null
                    ? (List<String>) body.get("permissions")
                    : List.of();
            cache.put(role, new CacheEntry(perms, System.currentTimeMillis() + TTL_MS));
            return perms;
        } catch (Exception e) {
            log.error("No se pudieron resolver permisos de '{}': {}", role, e.getMessage());
            return List.of(); // deny-by-default
        }
    }

    public void invalidate(String role) {
        cache.remove(role);
        log.info("Caché de permisos invalidada para rol '{}'", role);
    }

    /**
     * Consume eventos de invalidación. Cola anónima (una por instancia) enlazada al
     * exchange topic de authz con la routing key de cambios de permisos.
     */
    @RabbitListener(bindings = @QueueBinding(
            value = @Queue(autoDelete = "true", durable = "false"),
            exchange = @Exchange(value = "${app.authz.exchange:authz_exchange}",
                    type = ExchangeTypes.TOPIC, durable = "true"),
            key = "role_permissions.changed"))
    public void onAuthzEvent(Message message) {
        // Recibimos el Message crudo para NO pasar por el Jackson2MessageConverter global
        // (el publisher NestJS envía bytes JSON sin content_type).
        try {
            Map<String, Object> evt = objectMapper.readValue(message.getBody(), Map.class);
            Object service = evt.get("service");
            if (service == null || SERVICE_ID.equals(service)) {
                invalidate((String) evt.get("role"));
            }
        } catch (Exception e) {
            log.warn("Evento authz no procesable: {}", e.getMessage());
        }
    }
}
