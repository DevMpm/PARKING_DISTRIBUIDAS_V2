import os
import asyncio
import uuid

os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")
os.environ.setdefault("DB_NAME", "test_tickets_db")
os.environ.setdefault("DB_USER", "postgres")
os.environ.setdefault("DB_PASSWORD", "postgres")
os.environ.setdefault("ZONAS_URL", "http://localhost:8001")
os.environ.setdefault("VEHICULOS_URL", "http://localhost:8002")
os.environ.setdefault("USUARIOS_URL", "http://localhost:8003")
os.environ.setdefault("ASIGNACIONES_URL", "http://localhost:8004")

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from testcontainers.postgres import PostgresContainer

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.core.dependencies import get_zonas_client, get_vehiculos_client, get_asignaciones_client
from app.utils.rabbitmq_publisher import rabbitmq_publisher
from app.core.permissions_cache import permissions_cache

@pytest.fixture(scope="session")
def postgres_container():
    container = PostgresContainer("postgres:16-alpine")
    container.start()
    
    os.environ["DB_HOST"] = container.get_container_host_ip()
    os.environ["DB_PORT"] = str(container.get_exposed_port(5432))
    os.environ["DB_NAME"] = container.dbname
    os.environ["DB_USER"] = container.username
    os.environ["DB_PASSWORD"] = container.password
    
    yield container
    container.stop()

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session")
async def db_engine(postgres_container):
    url = f"postgresql+asyncpg://{os.environ['DB_USER']}:{os.environ['DB_PASSWORD']}@{os.environ['DB_HOST']}:{os.environ['DB_PORT']}/{os.environ['DB_NAME']}"
    engine = create_async_engine(url, echo=False, poolclass=NullPool)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(db_engine):
    async_session = async_sessionmaker(
        bind=db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    async with async_session() as session:
        yield session
        await session.rollback()

@pytest_asyncio.fixture
async def client(db_session, mocker, mock_clients):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    mocker.patch.object(permissions_cache, "get_permissions", return_value=[
        "TICKETS_CREATE", "TICKETS_READ", "TICKETS_UPDATE"
    ])
    mocker.patch.object(rabbitmq_publisher, "publish_ticket_event", return_value=None)
    mocker.patch.object(rabbitmq_publisher, "publish_audit_event", return_value=None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()

@pytest.fixture
def mock_clients(mocker):
    mock_zonas = mocker.MagicMock()
    mock_zonas.obtener_espacio = mocker.AsyncMock(return_value={
        "id": str(uuid.uuid4()),
        "idZona": str(uuid.uuid4()),
        "estado": "DISPONIBLE",
        "tipo": "AUTO"
    })
    mock_zonas.obtener_categoria_zona = mocker.AsyncMock(return_value="ESTANDAR")
    mock_zonas.actualizar_estado_espacio = mocker.AsyncMock(return_value=None)
    mock_zonas.obtener_zonas = mocker.AsyncMock(return_value=[{"id": str(uuid.uuid4()), "tipo": "ESTANDAR"}])

    mock_vehiculos = mocker.MagicMock()
    mock_vehiculos.obtener_vehiculo = mocker.AsyncMock(return_value={
        "id": str(uuid.uuid4()),
        "placa": "ABC-1234",
        "tipo": "AUTO",
        "idPropietario": str(uuid.uuid4())
    })

    mock_asignaciones = mocker.MagicMock()
    mock_asignaciones.obtener_asignacion_activa = mocker.AsyncMock(return_value=None)

    app.dependency_overrides[get_zonas_client] = lambda: mock_zonas
    app.dependency_overrides[get_vehiculos_client] = lambda: mock_vehiculos
    app.dependency_overrides[get_asignaciones_client] = lambda: mock_asignaciones

    mocker.patch("app.api.v1.endpoints.tickets.resolve_persona_id_by_dni", return_value=uuid.uuid4())

    return {
        "zonas": mock_zonas,
        "vehiculos": mock_vehiculos,
        "asignaciones": mock_asignaciones
    }
