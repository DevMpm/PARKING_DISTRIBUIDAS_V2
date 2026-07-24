from functools import lru_cache
import uuid
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.vehiculos_client import VehiculosClient
from app.clients.zonas_client import ZonasClient
from app.clients.asignaciones_client import AsignacionesClient
from app.core.permissions_cache import permissions_cache
from app.db.session import get_db
from app.repositories.ticket_repository import TicketRepository
from app.services.ticket_service import TicketService


async def get_current_empleado_id(
    x_user_id: Annotated[str | None, Header()] = None,
) -> uuid.UUID:
    """Kong ya validó el JWT contra gestion-usuarios y, si es válido,
    inyecta este header antes de llegar aquí. Si no viene, algo está
    mal configurado en el gateway (o llamaron al servicio sin pasar por Kong)."""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se encontró X-User-Id. La petición debe pasar por Kong.",
        )
    try:
        return uuid.UUID(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-User-Id inválido",
        )


class RequirePermissions:
    """Autorización PULL: obtiene el rol (header X-User-Roles inyectado por Kong)
    y resuelve sus permisos para este servicio vía PermissionsCache (caché +
    gestion-usuarios), en lugar de leer el header X-User-Permissions."""

    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    async def __call__(self, x_user_roles: Annotated[str | None, Header()] = None):
        if not x_user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No se encontró el rol en la solicitud",
            )

        # Token de rol único: X-User-Roles trae un solo rol (compat: tomamos el primero)
        role = x_user_roles.split(",")[0].strip()
        permissions = await permissions_cache.get_permissions(role)

        if self.required_permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso requerido: {self.required_permission}",
            )


def get_ticket_repository(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TicketRepository:
    return TicketRepository(db)

@lru_cache
def get_zonas_client() -> ZonasClient:
    return ZonasClient()

@lru_cache
def get_vehiculos_client() -> VehiculosClient:
    return VehiculosClient()

@lru_cache
def get_asignaciones_client() -> AsignacionesClient:
    return AsignacionesClient()


def get_ticket_service(
    ticket_repository: Annotated[TicketRepository, Depends(get_ticket_repository)],
    zonas_client: Annotated[ZonasClient, Depends(get_zonas_client)],
    vehiculos_client: Annotated[VehiculosClient, Depends(get_vehiculos_client)],
    asignaciones_client: Annotated[AsignacionesClient, Depends(get_asignaciones_client)],
    token: Annotated[str | None, Header(alias="Authorization")] = None,
) -> TicketService:
    return TicketService(
        ticket_repository=ticket_repository,
        zonas_client=zonas_client,
        vehiculos_client=vehiculos_client,
        asignaciones_client=asignaciones_client,
        token=token,
    )