import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket import Ticket
from app.utils.enums import EstadoTicket


class TicketRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, ticket: Ticket) -> Ticket:
        self.db.add(ticket)
        await self.db.commit()
        await self.db.refresh(ticket)
        return ticket

    async def get_by_id(self, id_ticket: uuid.UUID) -> Ticket | None:
        result = await self.db.execute(
            select(Ticket).where(Ticket.id_ticket == id_ticket)
        )
        return result.scalar_one_or_none()

    async def get_by_codigo(self, codigo_ticket: str) -> Ticket | None:
        result = await self.db.execute(
            select(Ticket).where(Ticket.codigo_ticket == codigo_ticket)
        )
        return result.scalar_one_or_none()

    async def get_activo_by_espacio(self, id_espacio: uuid.UUID) -> Ticket | None:
        """Útil para validar que un espacio no tenga ya un ticket activo
        antes de abrir uno nuevo."""
        result = await self.db.execute(
            select(Ticket).where(
                Ticket.id_espacio == id_espacio,
                Ticket.estado_ticket == EstadoTicket.ACTIVO,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_estado(self, estado: EstadoTicket) -> list[Ticket]:
        result = await self.db.execute(
            select(Ticket)
            .where(Ticket.estado_ticket == estado)
            .order_by(Ticket.fecha_hora_ingreso.desc())
        )
        return list(result.scalars().all())

    async def list_activos_by_usuario(self, id_usuario: uuid.UUID) -> list[Ticket]:
        """Tickets ACTIVOS de una persona (id_usuario == idPropietario del vehículo)."""
        result = await self.db.execute(
            select(Ticket)
            .where(
                Ticket.id_usuario == id_usuario,
                Ticket.estado_ticket == EstadoTicket.ACTIVO,
            )
            .order_by(Ticket.fecha_hora_ingreso.desc())
        )
        return list(result.scalars().all())

    async def list_all(self, skip: int = 0, limit: int = 100) -> list[Ticket]:
        result = await self.db.execute(
            select(Ticket).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def delete(self, ticket: Ticket) -> None:
        """Elimina un ticket de la base de datos. Se usa como rollback cuando
        la actualización síncrona del estado del espacio en Zonas falla."""
        await self.db.delete(ticket)
        await self.db.commit()

    async def update(self, ticket: Ticket) -> Ticket:
        """El objeto ya viene modificado (atributos seteados en el service);
        aquí solo se persiste el cambio."""
        await self.db.commit()
        await self.db.refresh(ticket)
        return ticket