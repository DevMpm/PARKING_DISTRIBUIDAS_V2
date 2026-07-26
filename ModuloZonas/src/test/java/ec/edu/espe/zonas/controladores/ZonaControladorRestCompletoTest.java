package ec.edu.espe.zonas.controladores;

import com.fasterxml.jackson.databind.ObjectMapper;
import ec.edu.espe.zonas.datos.dtos.ZonaRequestDTO;
import ec.edu.espe.zonas.dominio.entidades.Espacio;
import ec.edu.espe.zonas.dominio.entidades.EstadoEspacio;
import ec.edu.espe.zonas.dominio.entidades.TipoEspacio;
import ec.edu.espe.zonas.dominio.entidades.TipoZona;
import ec.edu.espe.zonas.dominio.entidades.Zona;
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
class ZonaControladorRestCompletoTest extends MockDatasource{


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
                new SimpleGrantedAuthority("ZONAS_CREATE"),
                new SimpleGrantedAuthority("ZONAS_READ"),
                new SimpleGrantedAuthority("ZONAS_UPDATE")
        );
    }

    // ==========================================
    // CREAR ZONA (CP1 - CP3)
    // ==========================================

    @Test
    void testCrearZonaExitoso_CP1() throws Exception {
        ZonaRequestDTO request = ZonaRequestDTO.builder()
                .nombre("Zona Central")
                .descripcion("Parqueadero principal central")
                .tipo(TipoZona.REGULAR)
                .capacidad(30)
                .build();

        mockMvc.perform(post("/api/v1/zonas/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.nombre", is("Zona Central")))
                .andExpect(jsonPath("$.codigo", startsWith("ZONA-REG.M-")))
                .andExpect(jsonPath("$.capacidad", is(30)))
                .andExpect(jsonPath("$.estado", is(1)));
    }

    @Test
    void testCrearZonaTipoMinusculas_CP2() throws Exception {
        ZonaRequestDTO request = ZonaRequestDTO.builder()
                .nombre("Zona Norte")
                .descripcion("Desc")
                .tipo(TipoZona.REGULAR)
                .capacidad(15)
                .build();

        mockMvc.perform(post("/api/v1/zonas/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipo", is("REGULAR")))
                .andExpect(jsonPath("$.codigo", startsWith("ZONA-REG.S-")));
    }

    @Test
    void testCrearZonaNombreInvalido_CP3_1() throws Exception {
        ZonaRequestDTO request = ZonaRequestDTO.builder()
                .nombre("") // Inválido por @NotBlank
                .descripcion("Sin nombre")
                .tipo(TipoZona.REGULAR)
                .capacidad(25)
                .build();

        mockMvc.perform(post("/api/v1/zonas/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testCrearZonaNombreDuplicado_CP3_2() throws Exception {
        Zona zonaExistente = new Zona();
        zonaExistente.setNombre("Zona Sur");
        zonaExistente.setCodigo("ZONA-SUR.S-01");
        zonaExistente.setCapacidad(15);
        zonaExistente.setEstado(1);
        zonaExistente.setTipo(TipoZona.REGULAR);
        zonaExistente.setFechaCreacion(LocalDateTime.now());
        zonaRepositorio.save(zonaExistente);

        ZonaRequestDTO request = ZonaRequestDTO.builder()
                .nombre("Zona Sur") // Duplicado case-insensitive
                .descripcion("Duplicada")
                .tipo(TipoZona.REGULAR)
                .capacidad(20)
                .build();

        mockMvc.perform(post("/api/v1/zonas/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict());
    }

    @Test
    void testCrearZonaTipoInvalido_CP3_3() throws Exception {
        String jsonRequest = "{\"nombre\":\"Zona Este\",\"descripcion\":\"Desc\",\"tipo\":\"INVALIDO\",\"capacidad\":25}";

        mockMvc.perform(post("/api/v1/zonas/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonRequest))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testCrearZonaCapacidadInvalida_CP3_4() throws Exception {
        ZonaRequestDTO request = ZonaRequestDTO.builder()
                .nombre("Zona Oeste")
                .descripcion("Capacidad fuera de rango")
                .tipo(TipoZona.VIP)
                .capacidad(150) // Máximo es 100
                .build();

        mockMvc.perform(post("/api/v1/zonas/")
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ==========================================
    // OBTENER ZONAS (CP4 - CP9)
    // ==========================================

    @Test
    void testObtenerZonas_CP4() throws Exception {
        for (int i = 1; i <= 4; i++) {
            Zona z = new Zona();
            z.setNombre("Zona " + i);
            z.setCodigo("ZONA-REG.S-0" + i);
            z.setCapacidad(10);
            z.setEstado(1);
            z.setTipo(TipoZona.REGULAR);
            z.setFechaCreacion(LocalDateTime.now());
            zonaRepositorio.save(z);
        }

        mockMvc.perform(get("/api/v1/zonas/")
                        .with(jwtPermisos()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)));
    }

    @Test
    void testObtenerZonasDesocupadasSiHay_CP4_1() throws Exception {
        Zona z1 = new Zona();
        z1.setNombre("Zona Desocupada");
        z1.setCodigo("ZONA-REG.S-01");
        z1.setCapacidad(10);
        z1.setEstado(1);
        z1.setTipo(TipoZona.REGULAR);
        z1.setFechaCreacion(LocalDateTime.now());
        zonaRepositorio.save(z1);

        Espacio e1 = new Espacio();
        e1.setCodigo("ESP-01");
        e1.setZona(z1);
        e1.setEstado(EstadoEspacio.DISPONIBLE);
        e1.setActivo(true);
        e1.setTipo(TipoEspacio.AUTO);
        e1.setFechaCreacion(LocalDateTime.now());
        espacioRepositorio.save(e1);

        mockMvc.perform(get("/api/v1/zonas/desocupadas")
                        .with(jwtPermisos()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].nombre", is("Zona Desocupada")));
    }

    @Test
    void testObtenerZonasPorTipo_CP5_CP9() throws Exception {
        Zona zReg = new Zona();
        zReg.setNombre("Zona Reg");
        zReg.setCodigo("ZONA-REG.M-01");
        zReg.setCapacidad(30);
        zReg.setEstado(1);
        zReg.setTipo(TipoZona.REGULAR);
        zReg.setFechaCreacion(LocalDateTime.now());
        zonaRepositorio.save(zReg);

        Zona zVip = new Zona();
        zVip.setNombre("Zona Vip");
        zVip.setCodigo("ZONA-VIP.M-02");
        zVip.setCapacidad(30);
        zVip.setEstado(1);
        zVip.setTipo(TipoZona.VIP);
        zVip.setFechaCreacion(LocalDateTime.now());
        zonaRepositorio.save(zVip);

        mockMvc.perform(get("/api/v1/zonas/tipo/VIP")
                        .with(jwtPermisos()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].tipo", is("VIP")));
    }

    // ==========================================
    // ACTUALIZAR ZONAS (CP10 - CP12)
    // ==========================================

    @Test
    void testActualizarDescripcion_CP10_1() throws Exception {
        Zona z = new Zona();
        z.setNombre("Zona Mod Desc");
        z.setCodigo("ZONA-REG.S-01");
        z.setCapacidad(10);
        z.setEstado(1);
        z.setTipo(TipoZona.REGULAR);
        z.setDescripcion("Descripcion antigua");
        z.setFechaCreacion(LocalDateTime.now());
        zonaRepositorio.save(z);

        ZonaRequestDTO request = ZonaRequestDTO.builder()
                .nombre("Zona Mod Desc")
                .descripcion("Descripcion actualizada correctamente")
                .tipo(TipoZona.REGULAR)
                .capacidad(10)
                .build();

        mockMvc.perform(put("/api/v1/zonas/" + z.getId())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.descripcion", is("Descripcion actualizada correctamente")));
    }

    @Test
    void testActualizarDescripcionInvalida_CP10_2() throws Exception {
        Zona z = new Zona();
        z.setNombre("Zona Test");
        z.setCodigo("ZONA-REG.S-01");
        z.setCapacidad(10);
        z.setEstado(1);
        z.setTipo(TipoZona.REGULAR);
        z.setFechaCreacion(LocalDateTime.now());
        zonaRepositorio.save(z);

        String descripcionLarga = "a".repeat(256); // Excede 255 caracteres
        ZonaRequestDTO request = ZonaRequestDTO.builder()
                .nombre("Zona Test")
                .descripcion(descripcionLarga)
                .tipo(TipoZona.REGULAR)
                .capacidad(10)
                .build();

        mockMvc.perform(put("/api/v1/zonas/" + z.getId())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testActualizarCapacidad_CP11_1() throws Exception {
        Zona z = new Zona();
        z.setNombre("Zona Capacidad");
        z.setCodigo("ZONA-REG.S-01");
        z.setCapacidad(10);
        z.setEstado(1);
        z.setTipo(TipoZona.REGULAR);
        z.setFechaCreacion(LocalDateTime.now());
        zonaRepositorio.save(z);

        ZonaRequestDTO request = ZonaRequestDTO.builder()
                .nombre("Zona Capacidad")
                .descripcion("Actualizando capacidad")
                .tipo(TipoZona.REGULAR)
                .capacidad(25)
                .build();

        mockMvc.perform(put("/api/v1/zonas/" + z.getId())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.capacidad", is(25)));
    }

    @Test
    void testActualizarCapacidadInvalida_CP11_2() throws Exception {
        Zona z = new Zona();
        z.setNombre("Zona Cap Inv");
        z.setCodigo("ZONA-REG.S-01");
        z.setCapacidad(10);
        z.setEstado(1);
        z.setTipo(TipoZona.REGULAR);
        z.setFechaCreacion(LocalDateTime.now());
        zonaRepositorio.save(z);

        ZonaRequestDTO request = ZonaRequestDTO.builder()
                .nombre("Zona Cap Inv")
                .descripcion("Capacidad invalida")
                .tipo(TipoZona.REGULAR)
                .capacidad(0) // Fuera de rango (min 1)
                .build();

        mockMvc.perform(put("/api/v1/zonas/" + z.getId())
                        .with(jwtPermisos())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

//     @Test
//     void testActualizarTipo_CP12_1() throws Exception {
//         Zona z = new Zona();
//         z.setNombre("Zona Tipo");
//         z.setCodigo("ZONA-REG.S-01");
//         z.setCapacidad(10);
//         z.setEstado(1);
//         z.setTipo(TipoZona.REGULAR);
//         z.setFechaCreacion(LocalDateTime.now());
//         zonaRepositorio.save(z);

//         ZonaRequestDTO request = ZonaRequestDTO.builder()
//                 .nombre("Zona Tipo")
//                 .descripcion("Cambiando tipo a VIP")
//                 .tipo(TipoZona.VIP)
//                 .capacidad(10)
//                 .build();

//         mockMvc.perform(put("/api/v1/zonas/" + z.getId())
//                         .with(jwtPermisos())
//                         .contentType(MediaType.APPLICATION_JSON)
//                         .content(objectMapper.writeValueAsString(request)))
//                 .andExpect(status().isOk())
//                 .andExpect(jsonPath("$.tipo", is("VIP")));
//     }

//     @Test
//     void testActualizarTipoInvalido_CP12_2() throws Exception {
//         Zona z = new Zona();
//         z.setNombre("Zona Tipo Inv");
//         z.setCodigo("ZONA-REG.S-01");
//         z.setCapacidad(10);
//         z.setEstado(1);
//         z.setTipo(TipoZona.REGULAR);
//         z.setFechaCreacion(LocalDateTime.now());
//         zonaRepositorio.save(z);

//         String jsonRequest = "{\"nombre\":\"Zona Tipo Inv\",\"descripcion\":\"Desc\",\"tipo\":\"TIPO_FALSO\",\"capacidad\":10}";

//         mockMvc.perform(put("/api/v1/zonas/" + z.getId())
//                         .with(jwtPermisos())
//                         .contentType(MediaType.APPLICATION_JSON)
//                         .content(jsonRequest))
//                 .andExpect(status().isBadRequest());
//     }

    // ==========================================
    // ACTIVAR / DESACTIVAR ZONAS (CP13 - CP14)
    // ==========================================

    @Test
    void testDesactivarZonaConEspaciosOcupados_CP13_1() throws Exception {
        Zona z = new Zona();
        z.setNombre("Zona Activa");
        z.setCodigo("ZONA-REG.S-01");
        z.setCapacidad(2);
        z.setEstado(1);
        z.setTipo(TipoZona.REGULAR);
        z.setFechaCreacion(LocalDateTime.now());
        zonaRepositorio.save(z);

        Espacio e1 = new Espacio();
        e1.setCodigo("ESP-01");
        e1.setZona(z);
        e1.setEstado(EstadoEspacio.OCUPADO);
        e1.setActivo(true);
        e1.setTipo(TipoEspacio.AUTO);
        e1.setFechaCreacion(LocalDateTime.now());
        espacioRepositorio.save(e1);

        // De acuerdo al servicio, si existen espacios ocupados lanza Forbidden (403)
        // Ocurrirá error por tipo de parámetro en repository si no está adaptado (TDD note),
        // pero evaluamos la regla REST esperada.
        mockMvc.perform(patch("/api/v1/zonas/" + z.getId())
                        .with(jwtPermisos()))
                .andExpect(status().isForbidden());
    }

    @Test
    void testActivarDesactivarZonaPatch_CP14_1() throws Exception {
        Zona z = new Zona();
        z.setNombre("Zona Toggle");
        z.setCodigo("ZONA-REG.S-01");
        z.setCapacidad(2);
        z.setEstado(1);
        z.setTipo(TipoZona.REGULAR);
        z.setFechaCreacion(LocalDateTime.now());
        zonaRepositorio.save(z);

        mockMvc.perform(patch("/api/v1/zonas/" + z.getId())
                        .with(jwtPermisos()))
                .andExpect(status().isNoContent());
    }
}
