from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.utils.enums import CategoriaVehiculo, CategoriaZona


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # ---------- App ----------
    APP_NAME: str = "ticket-service"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"  # development | production

    # ---------- Base de datos ----------
    DB_HOST: str
    DB_PORT: int = 5432
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    # ---------- Reglas de negocio: tarifas ----------
    TARIFA_MOTO_ESTANDAR: float = 0.75
    TARIFA_MOTO_VIP: float = 1.25
    TARIFA_AUTO_CAMIONETA_ESTANDAR: float = 1.25
    TARIFA_AUTO_CAMIONETA_VIP: float = 2.00
    HORAS_MINIMAS_COBRO: float = 1.0  # cobro mínimo en horas, se aplica sobre la tarifa que corresponda

    @property
    def TARIFAS(self) -> dict:
        return {
            (CategoriaVehiculo.MOTO, CategoriaZona.ESTANDAR): self.TARIFA_MOTO_ESTANDAR,
            (CategoriaVehiculo.MOTO, CategoriaZona.VIP): self.TARIFA_MOTO_VIP,
            (CategoriaVehiculo.AUTO_CAMIONETA, CategoriaZona.ESTANDAR): self.TARIFA_AUTO_CAMIONETA_ESTANDAR,
            (CategoriaVehiculo.AUTO_CAMIONETA, CategoriaZona.VIP): self.TARIFA_AUTO_CAMIONETA_VIP,
        }

    # ---------- URLs de otros microservicios ----------
    ZONAS_URL: str
    VEHICULOS_URL: str
    USUARIOS_URL: str
    ASIGNACIONES_URL: str
    PUBLIC_KEY_URL: str = "http://gestion-usuarios:3001/api/usuarios/auth/jwks"

    # ---------- Autorización pull (Fase 4) ----------
    USUARIOS_INTERNAL_URL: str = "http://gestion-usuarios:3001/api/usuarios"
    INTERNAL_API_KEY: str = ""
    AUTHZ_EXCHANGE: str = "authz_exchange"
    SERVICE_ID: str = "tickets-service"

    # ---------- RabbitMQ ----------
    RABBITMQ_HOST: str = "rabbitmq"
    RABBITMQ_PORT: int = 5672
    RABBITMQ_USER: str = "guest"
    RABBITMQ_PASSWORD: str = "guest"
    RABBITMQ_EXCHANGE: str = "parking.events"
    RABBITMQ_ROUTING_KEY: str = "ticket.#"
    AUDIT_EXCHANGE: str = "audit_exchange"
    AUDIT_ROUTING_KEY: str = "audit.event"

    # ---------- Timeouts de clients HTTP ----------
    HTTP_CLIENT_TIMEOUT: float = 15.0


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()