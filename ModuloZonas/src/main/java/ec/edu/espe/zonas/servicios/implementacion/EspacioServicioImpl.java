package ec.edu.espe.zonas.servicios.implementacion;

import ec.edu.espe.zonas.datos.dtos.EspacioRequestDTO;
import ec.edu.espe.zonas.datos.dtos.EspacioResponseDTO;
import ec.edu.espe.zonas.dominio.entidades.Espacio;
import ec.edu.espe.zonas.dominio.entidades.EstadoEspacio;
import ec.edu.espe.zonas.dominio.entidades.Zona;
import ec.edu.espe.zonas.dominio.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.dominio.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.servicios.EspacioServicio;
import ec.edu.espe.zonas.utils.SanitizadorTexto;
import ec.edu.espe.zonas.utils.UtilsMapper;
import ec.edu.espe.zonas.servicios.implementacion.EventEmitterService;
import ec.edu.espe.zonas.datos.dtos.EventoAuditoria;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.Map;

@RequiredArgsConstructor
@Service
public class EspacioServicioImpl implements EspacioServicio {

    private final EspacioRepositorio repositorioEspacio;
    private final ZonaRepositorio repositorioZona;
    private final UtilsMapper mapper;
    private final SanitizadorTexto sanitizador;
    private final EventEmitterService eventEmitterService;
    private final ObjectMapper objectMapper; // Para convertir objetos a Map

    private void emitirEventoAuditoria(String accion, Object espacio, Object datosExtra) {

        try {
        // 1. Convertimos y aseguramos que el mapa sea MUTABLE envolviéndolo en un nuevo HashMap
        Map<String, Object> mapaOriginal = objectMapper.convertValue(
            espacio, 
            new TypeReference<Map<String, Object>>() {}
        );
        Map<String, Object> datosFusionados = new HashMap<>(mapaOriginal); // <--- Esto evita el UnsupportedOperationException

        // 2. Convertimos y fusionamos los datos extra de forma segura
        if (datosExtra != null) {
            Map<String, Object> extra = objectMapper.convertValue(
                datosExtra,
                new TypeReference<Map<String, Object>>() {}
            );
            datosFusionados.putAll(extra);
        }

        String idEntidad = null;
        if (espacio instanceof EspacioResponseDTO) {
            idEntidad = ((EspacioResponseDTO) espacio).getId().toString();
        }

        // 3. Construimos el evento incluyendo TODOS los campos obligatorios (@NotNull)
        EventoAuditoria evento = EventoAuditoria.builder()
                .servicio("ms-zonas")
                .accion(accion)
                .entidad("ESPACIO")
                .usuario("usuario_anonimo")
                .idEntidad(idEntidad) // UUID
                .ip("127.0.0.1")            // Reemplázalo temporalmente para evitar que falle el @NotNull
                .mac("00:00:00:00:00:00")
                .rol("system")
                .datos(datosFusionados)
                .build();

        eventEmitterService.enviarEventoAuditoria(evento);

    } catch (Exception e) {
        // Capturamos cualquier fallo para que no tire abajo tu POST/PUT principal
        System.err.println("--- ERROR AL PROCESAR SERIALIZACIÓN DE AUDITORÍA ---");
        e.printStackTrace();
    }
    }

    @Override
    public List<EspacioResponseDTO> obtenerEspacios() {
        return repositorioEspacio.findAll().stream() //Stream es de la información proveniente
                .map(mapper::toEspacioResponseDto) // Llama al mapeador
                .collect(Collectors.toList());
    }

    @Override
    public EspacioResponseDTO obtenerEspacioPorId(UUID idEspacio) {
        Espacio espacio = repositorioEspacio.findById(idEspacio).orElse(null);
        if (espacio == null || !espacio.isActivo()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado");
        }
        EspacioResponseDTO responseDto = mapper.toEspacioResponseDto(espacio);
        emitirEventoAuditoria("SELECT", responseDto, null);
        return responseDto;
    }

    @Override
    public EspacioResponseDTO crearEspacio(EspacioRequestDTO request) {
        request.setDescripcion(sanitizador.escaparHtml(sanitizador.limpiarTexto(request.getDescripcion())));

        Zona objZona = repositorioZona.findById(request.getIdZona()).orElse(null);
        if(objZona == null) return null;


        int capacidadActualZona = objZona.getEspacios().size();

        if(capacidadActualZona < objZona.getCapacidad())
        {
            Espacio nuevoEspacio = mapper.toEntityEspacios(request);
            nuevoEspacio.setZona(objZona);

            // Autogenerar código del espacio
            nuevoEspacio.setCodigo(generarCodigoEspacio(objZona));

            // Default estado a DISPONIBLE si no se envió
            if (request.getEstado() != null) {
                nuevoEspacio.setEstado(request.getEstado());
            } else {
                nuevoEspacio.setEstado(EstadoEspacio.DISPONIBLE);
            }

            nuevoEspacio.setActivo(true);
            nuevoEspacio.setFechaCreacion(LocalDateTime.now(java.time.ZoneOffset.UTC));

            Espacio espacioSaved = repositorioEspacio.save(nuevoEspacio);

            EspacioResponseDTO responseDto = mapper.toEspacioResponseDto(espacioSaved);
            emitirEventoAuditoria("CREATE", responseDto, null);
            return responseDto;
        }
        else//Zona llena
        {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La zona ya está llena");

        }


    }

    @Override
    public EspacioResponseDTO actualizarEspacio(UUID idEspacio, EspacioRequestDTO request) {
        request.setDescripcion(sanitizador.escaparHtml(sanitizador.limpiarTexto(request.getDescripcion())));

        Espacio objEspacio = repositorioEspacio.findById(idEspacio).orElse(null);
        Espacio espacioOriginal = objEspacio; // Copia del objeto original para auditoría

        if(objEspacio == null) return null; //Espacio no encontrado

        //objEspacio.setEstado(request.getEstado());
        objEspacio.setDescripcion(request.getDescripcion());
        objEspacio.setTipo(request.getTipo());
        //Cambio de zona
        if(objEspacio.getZona().getId() != request.getIdZona()){
            Zona objZona = repositorioZona.findById(request.getIdZona()).orElse(null);
            if(objZona != null) objEspacio.setZona(objZona);
        };
        objEspacio.setFechaModificacion(LocalDateTime.now(java.time.ZoneOffset.UTC));

        Espacio espacioActualizado = repositorioEspacio.save(objEspacio);
        EspacioResponseDTO responseDto = mapper.toEspacioResponseDto(espacioActualizado);
        emitirEventoAuditoria("UPDATE", responseDto, mapper.toEspacioResponseDto(espacioOriginal)); // Enviamos el objeto original para auditoría

        return responseDto;
    }

    @Override
    public void eliminarEspacio(UUID idEspacio) {
        Espacio objEspacio = repositorioEspacio.findById(idEspacio).orElse(null);

        if(objEspacio == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado");
        }

        objEspacio.setActivo(false);
        EspacioResponseDTO responseDto = mapper.toEspacioResponseDto(objEspacio);
        emitirEventoAuditoria("DELETE", responseDto, null);
        repositorioEspacio.save(objEspacio);
    }

    @Override
    @Transactional
    public EspacioResponseDTO actualizarEstado(UUID idEspacio, EstadoEspacio estado) {
        if(estado == null || idEspacio == null) return null;

        Espacio objEspacio = repositorioEspacio.findById(idEspacio).orElse(null);
        Espacio espacioOriginal = objEspacio; // Copia del objeto original para auditoría

        if(objEspacio == null || objEspacio.getEstado() == estado) return null;

        objEspacio.setEstado(estado);
        EspacioResponseDTO responseDto = mapper.toEspacioResponseDto(objEspacio);
        emitirEventoAuditoria("UPDATE", responseDto, mapper.toEspacioResponseDto(espacioOriginal));

        return responseDto;
    }

    @Override
    public List<EspacioResponseDTO> obtenerEspacioPorEstado(EstadoEspacio estado) {
        return repositorioEspacio.findByEstado(estado).stream() //Stream es de la información proveniente
                .map(mapper::toEspacioResponseDto) // Llama al mapeador
                .collect(Collectors.toList());
    }

    @Override
    public List<EspacioResponseDTO> obtenerEspaciosPorZonaYEstado(UUID idZona, EstadoEspacio estado) {
        return repositorioEspacio.findByZonaIdAndEstado(idZona, estado).stream() //Stream es de la información proveniente
                .map(mapper::toEspacioResponseDto) // Llama al mapeador
                .collect(Collectors.toList());
    }

    @Override
    public List<EspacioResponseDTO> buscarPorTipo(ec.edu.espe.zonas.dominio.entidades.TipoEspacio tipo) {
        return repositorioEspacio.findByTipo(tipo).stream()
                .map(mapper::toEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    public List<EspacioResponseDTO> buscarPorTipoYZona(ec.edu.espe.zonas.dominio.entidades.TipoEspacio tipo, UUID idZona) {
        return repositorioEspacio.findByTipoAndZonaId(tipo, idZona).stream()
                .map(mapper::toEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    public List<EspacioResponseDTO> buscarPorZona(UUID idZona) {
        return repositorioEspacio.findByZonaId(idZona).stream()
                .map(mapper::toEspacioResponseDto)
                .collect(Collectors.toList());
    }

    /**
     * Genera un código único para el espacio basado en la zona.
     * Formato: {ZONA_CODIGO}-{NUM} donde NUM es el siguiente número secuencial
     * dentro de la zona (ej: ZONA-REG.S-01-03 para el espacio 3 de esa zona).
     * El código se ajusta al máximo de 12 caracteres de la columna.
     */
    private String generarCodigoEspacio(Zona zona) {
        int numEspacios = zona.getEspacios().size() + 1;
        String strNum = numEspacios > 9 ? String.valueOf(numEspacios) : "0" + numEspacios;

        // Tomar el código de la zona y truncar si es necesario para que quepa en 12 chars
        // Formato: {zonaCodigo}-{num} => zonaCodigo max = 12 - 1(guion) - len(strNum)
        String codigoZona = zona.getCodigo();
        int maxLenZona = 12 - 1 - strNum.length(); // reservar espacio para "-" y el número

        if (codigoZona.length() > maxLenZona) {
            codigoZona = codigoZona.substring(0, maxLenZona);
        }

        String codigo = codigoZona + "-" + strNum;

        // Verificar unicidad y agregar sufijo si ya existe
        while (repositorioEspacio.existsByCodigo(codigo)) {
            numEspacios++;
            strNum = numEspacios > 9 ? String.valueOf(numEspacios) : "0" + numEspacios;
            codigo = codigoZona + "-" + strNum;
        }

        return codigo;
    }
}
