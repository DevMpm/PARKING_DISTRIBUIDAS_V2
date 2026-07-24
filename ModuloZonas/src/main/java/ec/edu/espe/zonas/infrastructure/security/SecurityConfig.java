package ec.edu.espe.zonas.infrastructure.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity(debug = true)
@EnableMethodSecurity
public class SecurityConfig {

    private final PermissionsCacheService permissionsCacheService;

    public SecurityConfig(PermissionsCacheService permissionsCacheService) {
        this.permissionsCacheService = permissionsCacheService;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**").permitAll()
                .requestMatchers("/swagger-ui/**").permitAll()
                .requestMatchers("/swagger-ui.html").permitAll()
                .requestMatchers("/v3/api-docs").permitAll()
                .requestMatchers("/v3/api-docs/").permitAll()
                .requestMatchers("/v3/api-docs/**").permitAll()
                .requestMatchers("/error/**").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter()))
            );
        return http.build();
    }

    /**
     * Autorización PULL: en vez de leer las authorities del claim `permissions` del
     * token, se toma el rol único (`role`) y se resuelven sus permisos para este
     * servicio vía PermissionsCacheService (caché + gestion-usuarios).
     */
    @Bean
    public JwtAuthenticationConverter jwtAuthConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(this::authoritiesFromRole);
        return converter;
    }

    private Collection<GrantedAuthority> authoritiesFromRole(Jwt jwt) {
        String role = jwt.getClaimAsString("role");
        if (role == null) {
            // Compat con tokens antiguos que traían la lista `roles`
            List<String> roles = jwt.getClaimAsStringList("roles");
            if (roles != null && !roles.isEmpty()) {
                role = roles.get(0);
            }
        }
        if (role == null) {
            return List.of();
        }
        return permissionsCacheService.getPermissions(role).stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());
    }
}