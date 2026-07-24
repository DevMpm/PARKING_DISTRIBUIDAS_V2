package ec.edu.espe.zonas.servicios;

import ec.edu.espe.zonas.datos.dtos.EspacioRequestDTO;
import ec.edu.espe.zonas.datos.dtos.EspacioUpdateRequestDTO;
import ec.edu.espe.zonas.datos.dtos.EspacioResponseDTO;
import ec.edu.espe.zonas.dominio.entidades.EstadoEspacio;

import java.util.UUID;
import java.util.List;

public interface EspacioServicio {

    List<EspacioResponseDTO> obtenerEspacios();

    EspacioResponseDTO obtenerEspacioPorId(UUID idEspacio);

    EspacioResponseDTO crearEspacio(EspacioRequestDTO request);

    EspacioResponseDTO actualizarEspacio(UUID idEspacio, EspacioUpdateRequestDTO request);

    void eliminarEspacio(UUID idEspacio);

    EspacioResponseDTO actualizarEstado(UUID idEspacio, EstadoEspacio estado);

    List<EspacioResponseDTO> obtenerEspacioPorEstado(EstadoEspacio estado);

    List<EspacioResponseDTO> obtenerEspaciosPorZonaYEstado(UUID idZona, EstadoEspacio estado);
    List<EspacioResponseDTO> buscarPorTipo(ec.edu.espe.zonas.dominio.entidades.TipoEspacio tipo);
    List<EspacioResponseDTO> buscarPorTipoYZona(ec.edu.espe.zonas.dominio.entidades.TipoEspacio tipo, UUID idZona);
    List<EspacioResponseDTO> buscarPorZona(UUID idZona);
}
