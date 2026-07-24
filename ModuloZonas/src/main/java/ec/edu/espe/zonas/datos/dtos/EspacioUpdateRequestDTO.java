package ec.edu.espe.zonas.datos.dtos;
import ec.edu.espe.zonas.dominio.entidades.EstadoEspacio;
import ec.edu.espe.zonas.dominio.entidades.TipoEspacio;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Objeto de transferencia de datos para la actualización de un espacio")
public class EspacioUpdateRequestDTO {

    @Size(max = 128, message = "La descripción no puede superar los 128 caracteres")
    @Schema(description = "Descripción del espacio", example = "Espacio para discapacitados", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    private String descripcion;

    @Schema(description = "Tipo de vehículo que puede usar el espacio", example = "AUTO", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    private TipoEspacio tipo;

    @Schema(description = "Estado del espacio (opcional en creación)", example = "DISPONIBLE", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    private EstadoEspacio estado;
}
