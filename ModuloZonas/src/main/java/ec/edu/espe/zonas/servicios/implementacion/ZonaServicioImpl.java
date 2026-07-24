package ec.edu.espe.zonas.servicios.implementacion;

import ec.edu.espe.zonas.datos.dtos.ZonaRequestDTO;
import ec.edu.espe.zonas.datos.dtos.ZonaResponseDTO;
import ec.edu.espe.zonas.dominio.entidades.Espacio;
import ec.edu.espe.zonas.dominio.entidades.EstadoEspacio;
import ec.edu.espe.zonas.dominio.entidades.TipoZona;
import ec.edu.espe.zonas.dominio.entidades.Zona;
import ec.edu.espe.zonas.dominio.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.servicios.EspacioServicio;
import ec.edu.espe.zonas.servicios.ZonaServicio;
import ec.edu.espe.zonas.utils.SanitizadorTexto;
import ec.edu.espe.zonas.utils.UtilsMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ZonaServicioImpl implements ZonaServicio {
    private final ZonaRepositorio zonaRepositorio;
    private final EspacioServicio servicioEspacio;
    private final UtilsMapper mapper;
    private final SanitizadorTexto sanitizador;




    @Override
    public List<ZonaResponseDTO> listarZonas() {
        return zonaRepositorio.findAll().stream() //Stream es de la información proveniente
                .map(mapper::toZonaResponseDto) // Llama al mapeador
                .collect(Collectors.toList());
    }

    @Override
    public List<ZonaResponseDTO> listarZonasDesocupadas() {
        return zonaRepositorio.findAll().stream()
                .filter(z -> z.getEstado() == 1) // Solo activas
                .filter(z -> z.getEspacios().stream().noneMatch(e -> e.getEstado() == EstadoEspacio.OCUPADO))
                .map(mapper::toZonaResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    public List<ZonaResponseDTO> listarZonasPorTipo(TipoZona tipo) {
        return zonaRepositorio.findByTipo(tipo).stream()
                .map(mapper::toZonaResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    public ZonaResponseDTO crearZona(ZonaRequestDTO request) {
        request.setNombre(sanitizador.limpiarTexto(request.getNombre()));
        request.setDescripcion(sanitizador.escaparHtml(sanitizador.limpiarTexto(request.getDescripcion())));

        if (zonaRepositorio.existsByNombreIgnoreCase(request.getNombre())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe el nombre");
        }

        Zona objZona = new Zona();

        objZona.setNombre(request.getNombre());
        objZona.setCodigo(generarCodigo(request));
        objZona.setCapacidad(request.getCapacidad());
        objZona.setEstado(1);//Inicia como activo
        objZona.setDescripcion(request.getDescripcion());
        objZona.setTipo(TipoZona.valueOf(String.valueOf(request.getTipo())));
        objZona.setFechaCreacion(LocalDateTime.now(java.time.ZoneOffset.UTC));




        zonaRepositorio.save(objZona);

        return mapper.toZonaResponseDto(objZona);
    }

    @Override
    public ZonaResponseDTO actualizarZona(UUID idZona, ZonaRequestDTO request) {
        request.setNombre(sanitizador.limpiarTexto(request.getNombre()));
        request.setDescripcion(sanitizador.escaparHtml(sanitizador.limpiarTexto(request.getDescripcion())));
        Zona objZona = zonaRepositorio.findById(idZona).orElse(null);
        if(objZona == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la zona"); 
        //Valida nombre duplicado
         if (!request.getNombre().equalsIgnoreCase(objZona.getNombre()) && zonaRepositorio.existsByNombreIgnoreCase(request.getNombre())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe el nombre");
        }

        int cantidadEspacios = objZona.getEspacios().size();
        if (request.getCapacidad() < cantidadEspacios) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La capacidad no puede ser menor al numero de espacios ya existentes");
        }
        else {
            objZona.setCapacidad(request.getCapacidad());
        }
        if (request.getDescripcion() != "") 
        {
            objZona.setDescripcion(request.getDescripcion());
        }
        if (request.getNombre() != "")
        {
            objZona.setNombre(request.getNombre());
        }
        zonaRepositorio.save(objZona);
        return mapper.toZonaResponseDto(objZona);
    }

    @Override
    public void activarDesactivar(UUID idZona) {
        //Los espacios deben estar disponibles para poder ser desactivados
        //Se debe consultar los espacios
        Zona objZona = zonaRepositorio.findById(idZona).orElse(null);
        if(objZona == null ) return;
        //Validar espacios
        int estadoOriginal = objZona.getEstado();
        List<Espacio> espacios = objZona.getEspacios();
        if(estadoOriginal==1)//Estaba activo, lo voy a desactivar
        {
            boolean existenEspaciosOcupados = (servicioEspacio.obtenerEspaciosPorZonaYEstado(idZona, EstadoEspacio.OCUPADO).size() > 0);

            if(!existenEspaciosOcupados){
                for(Espacio espacio: espacios)
                {
                    espacio.setActivo(false);
                }
                objZona.setEstado(0);
            }
            else{
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Existen espacios opcupados. No se puede desactivar");
            }
        }
        else{
            for(Espacio espacio: espacios)
            {
                espacio.setActivo(true);
            }
            objZona.setEstado(1);
        }
        zonaRepositorio.save(objZona);
    }

    private String generarCodigo(ZonaRequestDTO request) {
        String tipo = request.getTipo().toString();
        int capacidad = request.getCapacidad();
        Long numeroZona = zonaRepositorio.count();

        //Define el tipo y la capacidad de la zona
        String strTipo = tipo.substring(0,3);
        String strCapacidad;
        if(capacidad <= 20)
        {
            strCapacidad = "S"; //Zona pequeña
        }
        else if(capacidad <= 50)
        {
            strCapacidad = "M"; //Zona Mediana
        }
        else{ //de 50 a 100 espacios
            strCapacidad = "L";
        }

        //Define el número de zona en la BD
        numeroZona = numeroZona == 0 ? 1L : numeroZona++;
        String strNumZona = numeroZona > 10 ? numeroZona.toString() : "0"+numeroZona.toString();

        String codigoZona = "ZONA-"+strTipo+"."+strCapacidad+"-"+strNumZona;

        return codigoZona;
    }



}
