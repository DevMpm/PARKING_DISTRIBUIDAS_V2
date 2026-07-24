"""
Autorización PULL para ticket-service.

- Al necesitar los permisos de un rol, los pide a gestion-usuarios (endpoint interno)
  filtrados por este servicio, y los cachea en memoria con TTL.
- Escucha eventos 'role_permissions.changed' por RabbitMQ para invalidar la caché
  (la caché con TTL es la red de seguridad si el evento no llega).
"""
import asyncio
import json
import logging
import time

import httpx
from aio_pika import connect_robust, ExchangeType

from app.core.config import settings

logger = logging.getLogger(__name__)

TTL_SECONDS = 5 * 60


class PermissionsCache:
    def __init__(self) -> None:
        # role -> {"perms": list[str], "exp": float}
        self._cache: dict[str, dict] = {}
        self._service_id = settings.SERVICE_ID
        self._internal_url = settings.USUARIOS_INTERNAL_URL.rstrip("/")
        self._internal_key = settings.INTERNAL_API_KEY
        self._exchange_name = settings.AUTHZ_EXCHANGE
        self._connection = None
        self._consumer_task: asyncio.Task | None = None

    async def get_permissions(self, role: str) -> list[str]:
        entry = self._cache.get(role)
        if entry and entry["exp"] > time.monotonic():
            return entry["perms"]

        # cache miss -> pull
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.post(
                    f"{self._internal_url}/internal/role-permissions/resolve",
                    json={"role": role, "serviceId": self._service_id},
                    headers={"x-internal-key": self._internal_key},
                )
            resp.raise_for_status()
            perms = resp.json().get("permissions", [])
            self._cache[role] = {"perms": perms, "exp": time.monotonic() + TTL_SECONDS}
            return perms
        except Exception as exc:  # noqa: BLE001
            logger.error("No se pudieron resolver permisos de '%s': %s", role, exc)
            return []  # deny-by-default

    def invalidate(self, role: str) -> None:
        self._cache.pop(role, None)
        logger.info("Caché de permisos invalidada para rol '%s'", role)

    # ---------------- RabbitMQ (invalidación) ----------------

    async def start_consumer(self) -> None:
        """Se conecta a RabbitMQ y consume eventos de invalidación en background."""
        try:
            url = (
                f"amqp://{settings.RABBITMQ_USER}:{settings.RABBITMQ_PASSWORD}"
                f"@{settings.RABBITMQ_HOST}:{settings.RABBITMQ_PORT}/"
            )
            self._connection = await connect_robust(url)
            channel = await self._connection.channel()
            exchange = await channel.declare_exchange(
                self._exchange_name, ExchangeType.TOPIC, durable=True
            )
            # Cola exclusiva por instancia: cada réplica invalida su propia caché.
            queue = await channel.declare_queue("", exclusive=True)
            await queue.bind(exchange, routing_key="role_permissions.changed")
            await queue.consume(self._on_message, no_ack=True)
            logger.info("✅ Suscrito a eventos authz para invalidación de caché")
        except Exception as exc:  # noqa: BLE001
            logger.error("❌ No se pudo suscribir a RabbitMQ (authz cache): %s", exc)

    async def _on_message(self, message) -> None:
        try:
            evt = json.loads(message.body.decode())
            if not evt.get("service") or evt.get("service") == self._service_id:
                self.invalidate(evt.get("role"))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Evento authz no procesable: %s", exc)

    async def stop_consumer(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()


permissions_cache = PermissionsCache()
