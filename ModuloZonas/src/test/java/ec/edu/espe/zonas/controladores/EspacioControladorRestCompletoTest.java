package ec.edu.espe.zonas.controladores;

import com.fasterxml.jackson.databind.ObjectMapper;
import ec.edu.espe.zonas.datos.dtos.BusquedaZonaEstadoDTO;
import ec.edu.espe.zonas.datos.dtos.EspacioRequestDTO;
import ec.edu.espe.zonas.datos.dtos.EspacioUpdateRequestDTO;
import ec.edu.espe.zonas.dominio.entidades.*;
import ec.edu.espe.zonas.dominio.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.dominio.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.setup.MockDatasource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;


import java.time.LocalDateTime;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@Transactional
@TestPropertySource(properties = {
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
    "spring.rabbitmq.listener.simple.auto-startup=false"
})
class EspacioControladorRestCompletoTest extends MockDatasource {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ZonaRepositorio zonaRepositorio;

    @Autowired
    private EspacioRepositorio espacioRepositorio;


    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor jwtPermisos() {
        return jwt().authorities(
                new SimpleGrantedAuthority("ZONAS_READ"),
                new SimpleGrantedAuthority("ZONAS_CREATE"),
                new SimpleGrantedAuthority("ZONAS_UPDATE"),
                new SimpleGrantedAuthority("ZONAS_DELETE")
        );
    }

    private Zona crearZonaAux(String nombre, int capacidad) {
        Zona z = new Zona();
        z.setNombre(nombre);
        z.setCodigo("ZON-" + nombre.toUpperCase().replaceAll("\\s+", "-"));
        z.setCapacidad(capacidad);
        z.setEstado(1);
        z.setTipo(TipoZona.REGULAR);
        z.setFechaCreacion(LocalDateTime.now());
        return zonaRepositorio.save(z);
    }

    private Espacio crearEspacioAux(Zona zona, TipoEspacio tipo, EstadoEspacio estado, String codigo) {
        Espacio e = new Espacio();
        e.setZona(zona);
        e.setTipo(tipo);
        e.setEstado(estado);
        e.setActivo(true);
        e.setCodigo(codigo);
        e.setFechaCreacion(LocalDateTime.now());
        return espacioRepositorio.save(e);
    }

    // CP1. Obtener espacios
    @Test
    void testObtenerEspacios_CP1() throws Exception {
        Zona zona = crearZonaAux("Zona CP1", 10);
        for (int i = 1; i <= 5; i++) {
            crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP1-0" + i);
        }

        mockMvc.perform(get("/api/v1/espacios/")
                        .with(jwtPermisos()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)));
    }

    // CP2.1. Obtener espacios por id ok
    @Test
    void testObtenerEspacioPorIdOk_CP2_1() throws Exception {
        Zona zona = crearZonaAux("Zona CP2_1", 5);
        Espacio espacio = crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP2-01");

        mockMvc.perform(get("/api/v1/espacios/" + espacio.getId())
                        .with(jwtPermisos()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(espacio.getId().toString())))
                .andExpect(jsonPath("$.codigo", is("ZON-CP2-01")));
    }

    // CP2.2. Obtener espacios por id no existente
    @Test
    void testObtenerEspacioPorIdNoExistente_CP2_2() throws Exception {
        UUID idInexistente = UUID.randomUUID();

        mockMvc.perform(get("/api/v1/espacios/" + idInexistente)
                        .with(jwtPermisos()))
                .andExpect(status().isNotFound());
    }

    // CP3.1. Crear espacio ok
    @Test
    void testCrearEspacioOk_CP3_1() throws Exception {
        Zona zona = crearZonaAux("Zona CP3_1", 5);

        EspacioRequestDTO request = EspacioRequestDTO.builder()
                .idZona(zona.getId())
                .descripcion("Espacio nuevo test")
                .tipo(TipoEspacio.AUTO)
                .estado(EstadoEspacio.DISPONIBLE)
                .build();

        mockMvc.perform(post("/api/v1/espacios/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.codigo").exists());
    }

    // CP3.2. Crear espacio - zona inexistente
    @Test
    void testCrearEspacioZonaInexistente_CP3_2() throws Exception {
        EspacioRequestDTO request = EspacioRequestDTO.builder()
                .idZona(UUID.randomUUID())
                .descripcion("Espacio sin zona")
                .tipo(TipoEspacio.AUTO)
                .estado(EstadoEspacio.DISPONIBLE)
                .build();

        mockMvc.perform(post("/api/v1/espacios/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    // CP3.3. Crear espacio - zona sin capacidad
    @Test
    void testCrearEspacioZonaSinCapacidad_CP3_3() throws Exception {
        Zona zona = crearZonaAux("Zona CP3_3", 1);
        crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP33-01");

        EspacioRequestDTO request = EspacioRequestDTO.builder()
                .idZona(zona.getId())
                .descripcion("Espacio extra")
                .tipo(TipoEspacio.AUTO)
                .estado(EstadoEspacio.DISPONIBLE)
                .build();

        mockMvc.perform(post("/api/v1/espacios/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    // CP3.4. Crear espacio - Descripción inválida (supera 128 caracteres)
    @Test
    void testCrearEspacioDescripcionInvalida_CP3_4() throws Exception {
        Zona zona = crearZonaAux("Zona CP3_4", 5);
        String descripcionLarga = "a".repeat(129);

        EspacioRequestDTO request = EspacioRequestDTO.builder()
                .idZona(zona.getId())
                .descripcion(descripcionLarga)
                .tipo(TipoEspacio.AUTO)
                .estado(EstadoEspacio.DISPONIBLE)
                .build();

        mockMvc.perform(post("/api/v1/espacios/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // CP3.5. Crear espacio - Tipo inválido
    @Test
    void testCrearEspacioTipoInvalido_CP3_5() throws Exception {
        Zona zona = crearZonaAux("Zona CP3_5", 5);
        String jsonRequest = "{\"idZona\":\"" + zona.getId() + "\",\"descripcion\":\"Test\",\"tipo\":\"INVALIDO\",\"estado\":\"DISPONIBLE\"}";

        mockMvc.perform(post("/api/v1/espacios/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonRequest))
                .andExpect(status().isBadRequest());
    }

    // CP3.6. Crear espacio - Estado inválido
    @Test
    void testCrearEspacioEstadoInvalido_CP3_6() throws Exception {
        Zona zona = crearZonaAux("Zona CP3_6", 5);
        String jsonRequest = "{\"idZona\":\"" + zona.getId() + "\",\"descripcion\":\"Test\",\"tipo\":\"AUTO\",\"estado\":\"ESTADO_FALSO\"}";

        mockMvc.perform(post("/api/v1/espacios/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonRequest))
                .andExpect(status().isBadRequest());
    }

    // CP4.1. Actualizar espacio ok
    @Test
    void testActualizarEspacioOk_CP4_1() throws Exception {
        Zona zona = crearZonaAux("Zona CP4_1", 5);
        Espacio espacio = crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP4-01");

        EspacioUpdateRequestDTO request = EspacioUpdateRequestDTO.builder()
                .descripcion("Actualizado OK")
                .tipo(TipoEspacio.MOTO)
                .estado(EstadoEspacio.RESERVADO)
                .build();

        mockMvc.perform(put("/api/v1/espacios/" + espacio.getId())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.descripcion", is("Actualizado OK")))
                .andExpect(jsonPath("$.tipo", is("MOTO")))
                .andExpect(jsonPath("$.estado", is("RESERVADO")));
    }

    // CP4.2. Actualizar espacio inexistente
    @Test
    void testActualizarEspacioInexistente_CP4_2() throws Exception {
        EspacioUpdateRequestDTO request = EspacioUpdateRequestDTO.builder()
                .descripcion("Inexistente")
                .tipo(TipoEspacio.AUTO)
                .estado(EstadoEspacio.DISPONIBLE)
                .build();

        mockMvc.perform(put("/api/v1/espacios/" + UUID.randomUUID())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    // CP4.3. Actualizar con descripción incorrecta
    @Test
    void testActualizarDescripcionIncorrecta_CP4_3() throws Exception {
        Zona zona = crearZonaAux("Zona CP4_3", 5);
        Espacio espacio = crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP43-01");

        EspacioUpdateRequestDTO request = EspacioUpdateRequestDTO.builder()
                .descripcion("a".repeat(129))
                .build();

        mockMvc.perform(put("/api/v1/espacios/" + espacio.getId())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // CP4.4. Actualizar con tipo incorrecto
    @Test
    void testActualizarTipoIncorrecto_CP4_4() throws Exception {
        Zona zona = crearZonaAux("Zona CP4_4", 5);
        Espacio espacio = crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP44-01");

        String jsonRequest = "{\"tipo\":\"TIPO_INVALIDO\"}";

        mockMvc.perform(put("/api/v1/espacios/" + espacio.getId())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonRequest))
                .andExpect(status().isBadRequest());
    }

    // CP4.5. Actualizar tipo cuando el espacio está ocupado
    @Test
    void testActualizarTipoEspacioOcupado_CP4_5() throws Exception {
        Zona zona = crearZonaAux("Zona CP4_5", 5);
        Espacio espacio = crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.OCUPADO, "ZON-CP45-01");

        EspacioUpdateRequestDTO request = EspacioUpdateRequestDTO.builder()
                .tipo(TipoEspacio.MOTO)
                .build();

        mockMvc.perform(put("/api/v1/espacios/" + espacio.getId())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    // CP4.6. Actualizar con estado incorrecto
    @Test
    void testActualizarEstadoIncorrecto_CP4_6() throws Exception {
        Zona zona = crearZonaAux("Zona CP4_6", 5);
        Espacio espacio = crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP46-01");

        String jsonRequest = "{\"estado\":\"ESTADO_INVALIDO\"}";

        mockMvc.perform(put("/api/v1/espacios/" + espacio.getId())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonRequest))
                .andExpect(status().isBadRequest());
    }

    // CP5.1. Eliminar espacio ok
    @Test
    void testEliminarEspacioOk_CP5_1() throws Exception {
        Zona zona = crearZonaAux("Zona CP5_1", 5);
        Espacio espacio = crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP51-01");

        mockMvc.perform(delete("/api/v1/espacios/" + espacio.getId())
                        .with(jwtPermisos()))
                .andExpect(status().isNoContent());
    }

    // CP5.2. Eliminar espacio inexistente
    @Test
    void testEliminarEspacioInexistente_CP5_2() throws Exception {
        mockMvc.perform(delete("/api/v1/espacios/" + UUID.randomUUID())
                        .with(jwtPermisos()))
                .andExpect(status().isNotFound());
    }

    // CP6.1. Cambio de estado de espacio ok
    @Test
    void testCambioEstadoEspacioOk_CP6_1() throws Exception {
        Zona zona = crearZonaAux("Zona CP6_1", 5);
        Espacio espacio = crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP61-01");

        mockMvc.perform(post("/api/v1/espacios/" + espacio.getId())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("\"OCUPADO\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado", is("OCUPADO")));
    }

    // CP6.2. Cambio de estado de espacio - Espacio no encontrado
    @Test
    void testCambioEstadoEspacioNoEncontrado_CP6_2() throws Exception {
        mockMvc.perform(post("/api/v1/espacios/" + UUID.randomUUID())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("\"OCUPADO\""))
                .andExpect(status().isNotFound());
    }

    // CP7.1. Obtener espacios por estado ok
    @Test
    void testObtenerEspaciosPorEstadoOk_CP7_1() throws Exception {
        Zona zona = crearZonaAux("Zona CP7_1", 5);
        crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP71-01");

        mockMvc.perform(get("/api/v1/espacios/estado")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("\"DISPONIBLE\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    // CP7.2. Obtener espacios por estado inválido
    @Test
    void testObtenerEspaciosPorEstadoInvalido_CP7_2() throws Exception {
        mockMvc.perform(get("/api/v1/espacios/estado")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("\"INVALIDO\""))
                .andExpect(status().isBadRequest());
    }

    // CP7.3. Obtener espacios por estado inexistente
    @Test
    void testObtenerEspaciosPorEstadoInexistente_CP7_3() throws Exception {
        Zona zona = crearZonaAux("Zona CP7_3", 5);
        crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP73-01");

        mockMvc.perform(get("/api/v1/espacios/estado")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("\"MANTENIMIENTO\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // CP8.1. Obtener espacios por zona y estado ok
    @Test
    void testObtenerEspaciosPorZonaYEstadoOk_CP8_1() throws Exception {
        Zona zona = crearZonaAux("Zona CP8_1", 5);
        crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP81-01");

        BusquedaZonaEstadoDTO dto = new BusquedaZonaEstadoDTO(zona.getId(), EstadoEspacio.DISPONIBLE);

        mockMvc.perform(get("/api/v1/espacios/zona-estado")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    // CP8.2. Obtener espacios por zona y estado - Datos inválidos
    @Test
    void testObtenerEspaciosPorZonaYEstadoDatosInvalidos_CP8_2() throws Exception {
        BusquedaZonaEstadoDTO dto = new BusquedaZonaEstadoDTO(null, null);

        mockMvc.perform(get("/api/v1/espacios/zona-estado")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest());
    }

    // CP8.3. Obtener espacios por zona y estado sin resultados
    @Test
    void testObtenerEspaciosPorZonaYEstadoSinResultados_CP8_3() throws Exception {
        Zona zona = crearZonaAux("Zona CP8_3", 5);
        crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP83-01");

        BusquedaZonaEstadoDTO dto = new BusquedaZonaEstadoDTO(zona.getId(), EstadoEspacio.OCUPADO);

        mockMvc.perform(get("/api/v1/espacios/zona-estado")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // CP9.1. Obtener espacios por tipo ok
    @Test
    void testObtenerEspaciosPorTipoOk_CP9_1() throws Exception {
        Zona zona = crearZonaAux("Zona CP9_1", 5);
        crearEspacioAux(zona, TipoEspacio.MOTO, EstadoEspacio.DISPONIBLE, "ZON-CP91-01");

        mockMvc.perform(get("/api/v1/espacios/tipo/MOTO")
                        .with(jwtPermisos()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    // CP9.2. Obtener espacios por tipo inválido
    @Test
    void testObtenerEspaciosPorTipoInvalido_CP9_2() throws Exception {
        mockMvc.perform(get("/api/v1/espacios/tipo/TIPO_FALSO")
                        .with(jwtPermisos()))
                .andExpect(status().isBadRequest());
    }

    // CP9.3. Obtener espacios por tipo no existente
    @Test
    void testObtenerEspaciosPorTipoNoExistente_CP9_3() throws Exception {
        Zona zona = crearZonaAux("Zona CP9_3", 5);
        crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP93-01");

        mockMvc.perform(get("/api/v1/espacios/tipo/BUSETA")
                        .with(jwtPermisos()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // CP10.1. Obtener espacios por zona y tipo ok
    @Test
    void testObtenerEspaciosPorZonaYTipoOk_CP10_1() throws Exception {
        Zona zona = crearZonaAux("Zona CP10_1", 5);
        crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP10-01");

        mockMvc.perform(get("/api/v1/espacios/zona/" + zona.getId() + "/tipo/AUTO")
                        .with(jwtPermisos()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    // CP10.2. Obtener espacios por zona y tipo - Datos inválidos
    @Test
    void testObtenerEspaciosPorZonaYTipoDatosInvalidos_CP10_2() throws Exception {
        mockMvc.perform(get("/api/v1/espacios/zona/" + UUID.randomUUID() + "/tipo/TIPO_FALSO")
                        .with(jwtPermisos()))
                .andExpect(status().isBadRequest());
    }

    // CP10.3. Obtener espacios por zona y tipo sin resultados
    @Test
    void testObtenerEspaciosPorZonaYTipoSinResultados_CP10_3() throws Exception {
        Zona zona = crearZonaAux("Zona CP10_3", 5);
        crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP103-01");

        mockMvc.perform(get("/api/v1/espacios/zona/" + zona.getId() + "/tipo/MOTO")
                        .with(jwtPermisos()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // CP11.1. Obtener espacios por zona ok
    @Test
    void testObtenerEspaciosPorZonaOk_CP11_1() throws Exception {
        Zona zona = crearZonaAux("Zona CP11_1", 5);
        crearEspacioAux(zona, TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE, "ZON-CP111-01");
        crearEspacioAux(zona, TipoEspacio.MOTO, EstadoEspacio.DISPONIBLE, "ZON-CP111-02");

        mockMvc.perform(get("/api/v1/espacios/zona/" + zona.getId())
                        .with(jwtPermisos()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    // CP11.2. Obtener espacios por zona nok
    @Test
    void testObtenerEspaciosPorZonaNok_CP11_2() throws Exception {
        // En Spring, si se pasa un UUID malformado o un ID inexistente / inválido para @PathVariable UUID
        mockMvc.perform(get("/api/v1/espacios/zona/id-invalido-uuid")
                        .with(jwtPermisos()))
                .andExpect(status().isBadRequest());
    }
}
