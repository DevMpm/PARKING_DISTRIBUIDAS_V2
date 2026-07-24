package ec.edu.espe.zonas.controladores;

import ec.edu.espe.zonas.datos.dtos.BusquedaZonaEstadoDTO;
import ec.edu.espe.zonas.datos.dtos.EspacioRequestDTO;
import ec.edu.espe.zonas.datos.dtos.EspacioUpdateRequestDTO;
import ec.edu.espe.zonas.datos.dtos.EspacioResponseDTO;
import ec.edu.espe.zonas.dominio.entidades.EstadoEspacio;
import ec.edu.espe.zonas.dominio.entidades.TipoEspacio;
import ec.edu.espe.zonas.servicios.EspacioServicio;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
@RestController
@RequestMapping("/api/v1/espacios")
@RequiredArgsConstructor
@Tag(name = "Espacios", description = "Operaciones relacionadas con los espacios de parqueo")
@SecurityRequirement(name = "bearerAuth")
public class EspacioControlador {
    private final EspacioServicio servicio;

    //Response Entity maneja por su cuenta los códigos HTTP
    @Operation(summary = "Obtener todos los espacios", description = "Retorna una lista de todos los espacios")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Operación exitosa")
    })
    @GetMapping("/")
    @PreAuthorize("hasAuthority('ZONAS_READ')")
    public ResponseEntity<List<EspacioResponseDTO>> getZonas()
    {
        return ResponseEntity.ok(servicio.obtenerEspacios());//200 si es exitoso, 500 si falla
    }

    @Operation(summary = "Obtener espacio por ID", description = "Retorna un espacio específico por su ID")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Operación exitosa"),
            @ApiResponse(responseCode = "404", description = "Espacio no encontrado")
    })
    @GetMapping("/{idEspacio}")
    @PreAuthorize("hasAuthority('ZONAS_READ')")
    public ResponseEntity<EspacioResponseDTO> obtenerEspacioPorId(@PathVariable UUID idEspacio)
    {
        return ResponseEntity.ok(servicio.obtenerEspacioPorId(idEspacio));
    }

    @Operation(summary = "Crear nuevo espacio", description = "Crea un nuevo espacio de parqueo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Espacio creado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos"),
            @ApiResponse(responseCode = "404", description = "Zona no encontrada")
    })
    @PostMapping("/")
    @PreAuthorize("hasAuthority('ZONAS_CREATE')")
    public ResponseEntity<EspacioResponseDTO> crearZona(@Valid @RequestBody EspacioRequestDTO request){
        //ZonaResponseDTO res = servicio.crearZona(request);
        // return new ResponseEntity<>(res, HttpStatus.CREATED);
        return new ResponseEntity<>(servicio.crearEspacio(request), HttpStatus.CREATED);
    }

    @Operation(summary = "Actualizar espacio", description = "Actualiza los datos de un espacio existente")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Espacio actualizado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos"),
            @ApiResponse(responseCode = "404", description = "Espacio no encontrado")
    })
    @PutMapping("/{idEspacio}")
    @PreAuthorize("hasAuthority('ZONAS_UPDATE')")
    public ResponseEntity<EspacioResponseDTO> actualizarEspacio(@PathVariable UUID idEspacio, @Valid @RequestBody  EspacioUpdateRequestDTO request){
        return ResponseEntity.ok(servicio.actualizarEspacio(idEspacio, request));
    }

    @Operation(summary = "Eliminar espacio", description = "Elimina de forma lógica (inactiva) un espacio de parqueo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Espacio eliminado exitosamente"),
            @ApiResponse(responseCode = "404", description = "Espacio no encontrado")
    })
    @DeleteMapping("/{idEspacio}")
    @PreAuthorize("hasAuthority('ZONAS_DELETE')")
    public  ResponseEntity<Void> eliminarEspacio(@PathVariable UUID idEspacio){
        servicio.eliminarEspacio(idEspacio);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Actualizar estado del espacio", description = "Cambia el estado de un espacio específico")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Estado actualizado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Estado inválido"),
            @ApiResponse(responseCode = "404", description = "Espacio no encontrado")
    })
    @PostMapping("/{idEspacio}")
    @PreAuthorize("hasAuthority('ZONAS_UPDATE')")
    public ResponseEntity<EspacioResponseDTO> actualizarEstado(@PathVariable UUID idEspacio, @RequestBody EstadoEspacio estado){
        if (estado == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(servicio.actualizarEstado(idEspacio, estado));
    }

    @Operation(summary = "Obtener espacios por estado", description = "Retorna una lista de espacios filtrados por estado")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Operación exitosa"),
            @ApiResponse(responseCode = "400", description = "Estado inválido")
    })
    @GetMapping("/estado")
    @PreAuthorize("hasAuthority('ZONAS_READ')")
    public ResponseEntity<List<EspacioResponseDTO>> obtenerEspaciosPorEstado(@RequestBody EstadoEspacio estado){
        if (estado == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(servicio.obtenerEspacioPorEstado(estado));
    }

    @Operation(summary = "Obtener espacios por zona y estado", description = "Retorna una lista de espacios en una zona específica y con un estado determinado")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Operación exitosa"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos")
    })
    @GetMapping("/zona-estado")
    @PreAuthorize("hasAuthority('ZONAS_READ')")
    public ResponseEntity<List<EspacioResponseDTO>> obtenerEspaciosPorZonaYEstado(@Valid @RequestBody BusquedaZonaEstadoDTO request){
        return ResponseEntity.ok(servicio.obtenerEspaciosPorZonaYEstado(request.getIdZona(), request.getEstado()));
    }

    @Operation(summary = "Obtener espacios por tipo", description = "Retorna una lista de espacios filtrados por su tipo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Operación exitosa"),
            @ApiResponse(responseCode = "400", description = "Tipo de espacio inválido")
    })
    @GetMapping("/tipo/{tipo}")
    @PreAuthorize("hasAuthority('ZONAS_READ')")
    public ResponseEntity<List<EspacioResponseDTO>> obtenerEspaciosPorTipo(@PathVariable TipoEspacio tipo){
        return ResponseEntity.ok(servicio.buscarPorTipo(tipo));
    }

    @Operation(summary = "Obtener espacios por tipo y zona", description = "Retorna una lista de espacios de un tipo específico en una zona determinada")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Operación exitosa"),
            @ApiResponse(responseCode = "400", description = "Tipo de espacio inválido"),
            @ApiResponse(responseCode = "404", description = "Zona no encontrada")
    })
    @GetMapping("/zona/{idZona}/tipo/{tipo}")
    @PreAuthorize("hasAuthority('ZONAS_READ')")
    public ResponseEntity<List<EspacioResponseDTO>> obtenerEspaciosPorTipoYZona(@PathVariable UUID idZona, @PathVariable TipoEspacio tipo){
        return ResponseEntity.ok(servicio.buscarPorTipoYZona(tipo, idZona));
    }

    @Operation(summary = "Obtener espacios por zona", description = "Retorna todos los espacios pertenecientes a una zona específica")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Operación exitosa"),
            @ApiResponse(responseCode = "404", description = "Zona no encontrada")
    })
    @GetMapping("/zona/{idZona}")
    @PreAuthorize("hasAuthority('ZONAS_READ')")
    public ResponseEntity<List<EspacioResponseDTO>> obtenerEspaciosPorZona(@PathVariable UUID idZona){
        return ResponseEntity.ok(servicio.buscarPorZona(idZona));
    }


}
