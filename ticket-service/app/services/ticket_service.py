import logging
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.models.ticket import Ticket
from app.repositories.ticket_repository import TicketRepository
from app.schemas.ticket import TicketAnular, TicketCreate, TicketRegistrarSalida
from app.utils.enums import EstadoTicket, CategoriaVehiculo
from decimal import Decimal
from app.utils.exceptions import (
    EspacioNoDisponibleException,
    EspacioOcupadoException,
    EstadoInvalidoException,
    TicketNoEncontradoException,
    VehiculoNoEncontradoException,
)
from app.utils.rabbitmq_publisher import rabbitmq_publisher
from app.sse.sse_service import sse_service

logger = logging.getLogger(__name__)


class TicketService:
    def __init__(
        self,
        ticket_repository: TicketRepository,
        zonas_client,
        vehiculos_client,
        asignaciones_client,
        token: str | None = None,
    ):
        self.ticket_repository = ticket_repository
        self.zonas_client = zonas_client
        self.vehiculos_client = vehiculos_client
        self.asignaciones_client = asignaciones_client
        self.token = token

    async def create_ticket(
        self, data: TicketCreate, id_empleado: uuid.UUID
    ) -> Ticket:
        espacio = await self.zonas_client.obtener_espacio(data.id_espacio, self.token)
        if espacio is None or espacio.get("estado") != "DISPONIBLE":
            raise EspacioNoDisponibleException(
                f"El espacio {data.id_espacio} no está disponible"
            )

        categoria_zona = await self.zonas_client.obtener_categoria_zona(
            espacio["idZona"], self.token
        )

        # Buscar el vehículo para obtener su ID y categoría
        vehiculo = await self.vehiculos_client.obtener_vehiculo(data.placa, self.token)
        if not vehiculo:
            raise VehiculoNoEncontradoException(f"El vehículo con placa {data.placa} no existe")
        
        # Obtener categoría manualmente (evitamos llamar obtener_categoria_vehiculo que hace otra request)
        tipo = vehiculo.get("tipo")
        if not tipo:
            if "numeroPuertas" in vehiculo and vehiculo["numeroPuertas"] is not None:
                tipo = "AUTO"
            elif "tipoMoto" in vehiculo and vehiculo["tipoMoto"] is not None:
                tipo = "MOTO"
            elif "capacidadCarga" in vehiculo and vehiculo["capacidadCarga"] is not None:
                tipo = "CAMIONETA"
            else:
                tipo = "AUTO"
        from app.utils.tarifas import mapear_categoria_vehiculo
        categoria_vehiculo = mapear_categoria_vehiculo(tipo)

        # Validar que el espacio corresponda al tipo de vehículo
        tipo_espacio = str(espacio.get("tipo", "")).upper().strip()
        import logging
        logging.getLogger(__name__).warning(f"DEBUG VALIDACION: tipo_espacio={tipo_espacio}, categoria_vehiculo={categoria_vehiculo}")
        
        if tipo_espacio == "MOTO" and categoria_vehiculo != CategoriaVehiculo.MOTO:
            raise EstadoInvalidoException("El espacio seleccionado es para MOTOS, pero el vehículo ingresado no es una moto.")
        if tipo_espacio == "AUTO" and categoria_vehiculo != CategoriaVehiculo.AUTO_CAMIONETA:
            raise EstadoInvalidoException("El espacio seleccionado es para AUTOS, pero el vehículo ingresado no es un auto/camioneta.")
        if tipo_espacio == "BUSETA" and str(tipo).upper() != "BUSETA":
            raise EstadoInvalidoException("El espacio seleccionado es para BUSETAS, pero el vehículo ingresado no es una buseta.")

        # Inferir usuario a partir del vehículo o de asignaciones_client
        id_usuario = None
        if vehiculo.get("idPropietario"):
            try:
                id_usuario = uuid.UUID(vehiculo["idPropietario"])
            except ValueError:
                pass

        if not id_usuario:
            asignacion = await self.asignaciones_client.obtener_asignacion_activa(vehiculo["id"], self.token)
            if asignacion and "userId" in asignacion:
                try:
                    id_usuario = uuid.UUID(asignacion["userId"])
                except ValueError:
                    pass

        ticket_activo = await self.ticket_repository.get_activo_by_espacio(
            data.id_espacio
        )
        if ticket_activo:
            raise EspacioOcupadoException(
                f"El espacio {data.id_espacio} ya tiene un ticket activo"
            )

        tarifa_hora = settings.TARIFAS[(categoria_vehiculo, categoria_zona)]

        nuevo_ticket = Ticket(
            id_espacio=data.id_espacio,
            id_usuario=id_usuario,
            placa=data.placa,
            id_empleado=id_empleado,
            codigo_ticket=self._generar_codigo_ticket(),
            estado_ticket=EstadoTicket.ACTIVO,
            categoria_vehiculo=categoria_vehiculo,
            categoria_zona=categoria_zona,
            tarifa_hora_aplicada=tarifa_hora,
        )
        ticket_creado = await self.ticket_repository.create(nuevo_ticket)

        # Actualizar estado del espacio sincrónicamente en Zonas
        try:
            await self.zonas_client.actualizar_estado_espacio(
                data.id_espacio, "OCUPADO", self.token
            )
        except Exception as exc:
            # Rollback: eliminar el ticket recién creado si Zonas falla
            logger.error(
                f"Fallo al actualizar espacio {data.id_espacio} a OCUPADO en Zonas: {exc}. "
                f"Revirtiendo ticket {ticket_creado.codigo_ticket}."
            )
            await self.ticket_repository.delete(ticket_creado)
            raise

        # Emitir evento a RabbitMQ y a los clientes conectados por SSE
        await self._emitir_evento_espacio(
            "created", data.id_espacio, "OCUPADO"
        )
        return ticket_creado

    async def registrar_salida(
        self, id_ticket: uuid.UUID, data: TicketRegistrarSalida
    ) -> Ticket:
        ticket = await self._get_ticket_o_falla(id_ticket)

        if ticket.estado_ticket != EstadoTicket.ACTIVO:
            raise EstadoInvalidoException(
                f"El ticket {ticket.codigo_ticket} no está activo, "
                f"estado actual: {ticket.estado_ticket}"
            )

        ticket.fecha_hora_salida = data.fecha_hora_salida or datetime.now(
            timezone.utc
        )
        ticket.valor_recaudado = self._calcular_valor_recaudado(
            ticket.fecha_hora_ingreso,
            ticket.fecha_hora_salida,
            ticket.tarifa_hora_aplicada,
        )
        ticket.estado_ticket = EstadoTicket.PAGADO

        ticket_actualizado = await self.ticket_repository.update(ticket)

        # Actualizar estado del espacio sincrónicamente en Zonas
        try:
            await self.zonas_client.actualizar_estado_espacio(
                ticket.id_espacio, "DISPONIBLE", self.token
            )
        except Exception as exc:
            logger.error(
                f"Fallo al liberar espacio {ticket.id_espacio} en Zonas: {exc}. "
                f"El ticket {ticket.codigo_ticket} ya fue marcado como PAGADO."
            )
            # No hacemos rollback del ticket ya pagado, pero logueamos la inconsistencia

        # Emitir evento a RabbitMQ para notificar por SSE
        await self._emitir_evento_espacio(
            "salida_registrada", ticket.id_espacio, "DISPONIBLE"
        )
        return ticket_actualizado

    async def anular_ticket(
        self, id_ticket: uuid.UUID, data: TicketAnular
    ) -> Ticket:
        ticket = await self._get_ticket_o_falla(id_ticket)

        if ticket.estado_ticket != EstadoTicket.ACTIVO:
            raise EstadoInvalidoException(
                f"Solo se pueden anular tickets activos. "
                f"Estado actual: {ticket.estado_ticket}"
            )

        ticket.estado_ticket = EstadoTicket.ANULADO
        ticket_actualizado = await self.ticket_repository.update(ticket)

        # Actualizar estado del espacio sincrónicamente en Zonas
        try:
            await self.zonas_client.actualizar_estado_espacio(
                ticket.id_espacio, "DISPONIBLE", self.token
            )
        except Exception as exc:
            logger.error(
                f"Fallo al liberar espacio {ticket.id_espacio} en Zonas tras anulación: {exc}. "
                f"El ticket {ticket.codigo_ticket} ya fue anulado."
            )

        # Emitir evento a RabbitMQ para notificar por SSE
        await self._emitir_evento_espacio(
            "anulado", ticket.id_espacio, "DISPONIBLE"
        )
        return ticket_actualizado

    async def get_ticket(self, id_ticket: uuid.UUID) -> Ticket:
        return await self._get_ticket_o_falla(id_ticket)

    async def list_activos(
        self, id_usuario: uuid.UUID | None = None
    ) -> list[Ticket]:
        """Lista los tickets ACTIVOS. Si se pasa id_usuario (id de la persona
        propietaria), filtra solo los suyos; útil para buscar por cédula."""
        if id_usuario is not None:
            return await self.ticket_repository.list_activos_by_usuario(id_usuario)
        return await self.ticket_repository.list_by_estado(EstadoTicket.ACTIVO)

    # ---------- helpers privados ----------

    @staticmethod
    async def _emitir_evento_espacio(
        event_type: str, id_espacio: uuid.UUID, estado: str
    ) -> None:
        payload = {"id_espacio": str(id_espacio), "estado": estado}
        try:
            await rabbitmq_publisher.publish_ticket_event(event_type, payload)
        except Exception as exc:
            logger.error(f"Error publicando evento RabbitMQ {event_type}: {exc}")
        await sse_service.emit_event(event_type, payload)

    async def _get_ticket_o_falla(self, id_ticket: uuid.UUID) -> Ticket:
        ticket = await self.ticket_repository.get_by_id(id_ticket)
        if not ticket:
            raise TicketNoEncontradoException(
                f"No existe un ticket con id {id_ticket}"
            )
        return ticket

    @staticmethod
    def _generar_codigo_ticket() -> str:
        fecha = datetime.now(timezone.utc).strftime("%Y%m%d")
        sufijo = uuid.uuid4().hex[:6].upper()
        return f"TCK-{fecha}-{sufijo}"

    @staticmethod
    def _calcular_valor_recaudado(
        ingreso: datetime, salida: datetime, tarifa_hora: Decimal
    ) -> Decimal:
        horas = Decimal(str((salida - ingreso).total_seconds() / 3600))
        horas_minimas = Decimal(str(settings.HORAS_MINIMAS_COBRO))
        horas = max(horas, horas_minimas)
        return (horas * tarifa_hora).quantize(Decimal("0.01"))