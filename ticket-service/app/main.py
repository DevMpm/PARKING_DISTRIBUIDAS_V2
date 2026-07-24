from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer

from app.api.v1.router import api_router
from app.core.config import settings
from app.sse.sse_router import router as sse_router
from app.utils.exceptions import (
    EspacioNoDisponibleException,
    EspacioOcupadoException,
    EstadoInvalidoException,
    ServicioExternoException,
    TicketNoEncontradoException,
    VehiculoNoEncontradoException,
)

import asyncio
import json
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from app.utils.rabbitmq_publisher import rabbitmq_publisher
from app.core.permissions_cache import permissions_cache

logger_audit = logging.getLogger("audit_middleware")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: las tablas se crean vía Alembic, no aquí.
    # Suscribe la caché de permisos a los eventos de invalidación.
    await permissions_cache.start_consumer()
    yield
    # Shutdown: liberar recursos.
    await permissions_cache.stop_consumer()

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        method = request.method
        path = request.url.path
        
        response = await call_next(request)
        
        if response.status_code < 400:
            accion_map = {'POST': 'CREATE', 'PUT': 'UPDATE', 'PATCH': 'UPDATE', 'DELETE': 'DELETE', 'GET': 'SELECT'}
            accion = accion_map.get(method, 'SELECT')
            
            # Extract IP and MAC
            ip = request.headers.get('X-Forwarded-For', request.headers.get('X-Real-IP', request.client.host if request.client else '127.0.0.1'))
            if ',' in ip:
                ip = ip.split(',')[0].strip()
            mac = request.headers.get('X-MAC-Address', '00:00:00:00:00:00')
            
            # Extract User info
            usuario = 'system'
            rol = 'system'
            x_user_id = request.headers.get('X-User-Id')
            x_user_roles = request.headers.get('X-User-Roles')
            if x_user_id:
                usuario = x_user_id  # Using UUID as username since we don't have username string here
            if x_user_roles:
                roles = x_user_roles.split(',')
                rol = roles[0] if roles else 'system'
            
            audit_payload = {
                "servicio": "ms-tickets",
                "accion": accion,
                "entidad": "TICKET",
                "usuario": usuario,
                "rol": rol,
                "ip": ip,
                "mac": mac,
                "datos": {
                    "path": path,
                    "method": method,
                    "status_code": response.status_code
                }
            }
            task = asyncio.create_task(rabbitmq_publisher.publish_audit_event(audit_payload))
            task.add_done_callback(
                lambda t: logger_audit.error(f"Audit publish failed: {t.exception()}") if t.exception() else None
            )
            
        return response

security_scheme = HTTPBearer()

app = FastAPI(
    title="API de Gestión de Tickets",
    version="1.0.0",
    lifespan=lifespan,
    description="API para la gestión de tickets de estacionamiento.",
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)
app.include_router(sse_router)
app.add_middleware(AuditMiddleware)


# ---------- Exception handlers globales ----------
# Traducen las excepciones de dominio (definidas en utils/exceptions.py)
# a respuestas HTTP, sin ensuciar los endpoints con try/except.

@app.exception_handler(TicketNoEncontradoException)
async def ticket_no_encontrado_handler(request: Request, exc: TicketNoEncontradoException):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(VehiculoNoEncontradoException)
async def vehiculo_no_encontrado_handler(request: Request, exc: VehiculoNoEncontradoException):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(EspacioNoDisponibleException)
async def espacio_no_disponible_handler(request: Request, exc: EspacioNoDisponibleException):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(EspacioOcupadoException)
async def espacio_ocupado_handler(request: Request, exc: EspacioOcupadoException):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(EstadoInvalidoException)
async def estado_invalido_handler(request: Request, exc: EstadoInvalidoException):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(ServicioExternoException)
async def servicio_externo_handler(request: Request, exc: ServicioExternoException):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME}