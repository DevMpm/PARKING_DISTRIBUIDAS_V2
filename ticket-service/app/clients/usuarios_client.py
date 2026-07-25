"""Cliente interno hacia gestion-usuarios para resolver una cédula (DNI) a personId.

Usa el endpoint interno protegido por x-internal-key, de modo que el usuario final
(p.ej. RECAUDADOR) NO necesita el permiso USUARIOS_READ para buscar tickets por cédula.
"""
import logging
import uuid

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def resolve_persona_id_by_dni(dni: str) -> uuid.UUID | None:
    url = settings.USUARIOS_INTERNAL_URL.rstrip("/") + "/internal/personas/resolve"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                url,
                params={"dni": dni},
                headers={"x-internal-key": settings.INTERNAL_API_KEY},
            )
        resp.raise_for_status()
        person_id = resp.json().get("personId")
        return uuid.UUID(person_id) if person_id else None
    except Exception as exc:  # noqa: BLE001
        logger.error("No se pudo resolver la cédula %s: %s", dni, exc)
        return None
