package ec.edu.espe.zonas.dominio.repositorios;

import ec.edu.espe.zonas.dominio.entidades.Espacio;
import ec.edu.espe.zonas.dominio.entidades.EstadoEspacio;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EspacioRepositorio extends JpaRepository<Espacio, UUID> {
    boolean existsByCodigo(String codigo);
    List<Espacio> findByZona(UUID idZona);
    List<Espacio> findByEstado(EstadoEspacio estado);
    List<Espacio> findByZonaIdAndEstado(UUID zonaId, EstadoEspacio estado);
    List<Espacio> findByTipo(ec.edu.espe.zonas.dominio.entidades.TipoEspacio tipo);
    List<Espacio> findByTipoAndZonaId(ec.edu.espe.zonas.dominio.entidades.TipoEspacio tipo, UUID idZona);
    List<Espacio> findByZonaId(UUID idZona);
}
