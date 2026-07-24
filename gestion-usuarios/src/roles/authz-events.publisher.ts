import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface RolePermissionsChangedEvent {
  event: 'role_permissions.changed';
  role: string;
  service: string | null;
  at: string;
}

/**
 * Publica eventos de autorización (cambios en permisos de un rol) para que los
 * microservicios consumidores invaliden su caché de permisos (Fase 4).
 *
 * Usa un exchange `topic` propio (`authz_exchange`) separado del de auditoría.
 * Es best-effort: si RabbitMQ no está disponible, no bloquea la operación
 * (la caché de los consumidores tiene TTL como red de seguridad).
 */
@Injectable()
export class AuthzEventsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthzEventsPublisher.name);
  private connection: any = null;
  private channel: any = null;
  private isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private readonly exchange: string;
  private readonly routingKey = 'role_permissions.changed';

  constructor(private readonly configService: ConfigService) {
    this.exchange =
      this.configService.get('AUTHZ_EXCHANGE') ?? 'authz_exchange';
  }

  async onModuleInit() {
    await this.connect();
  }

  private async connect(): Promise<void> {
    const host = this.configService.get('RABBITMQ_HOST');
    const port = this.configService.get('RABBITMQ_PORT');
    const user = this.configService.get('RABBITMQ_USER');
    const pass = this.configService.get('RABBITMQ_PASSWORD');
    const url = `amqp://${user}:${pass}@${host}:${port}`;

    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });
      this.isConnected = true;
      this.logger.log('✅ AuthzEventsPublisher conectado a RabbitMQ');

      this.connection.on('close', () => {
        this.isConnected = false;
        this.channel = null;
        this.connection = null;
        this.scheduleReconnect();
      });
      this.connection.on('error', (err: any) => {
        this.logger.error(`❌ Error RabbitMQ (authz): ${err.message}`);
        this.isConnected = false;
        this.channel = null;
        this.connection = null;
        this.scheduleReconnect();
      });
    } catch (error) {
      this.isConnected = false;
      const msg = error instanceof Error ? error.message : 'desconocido';
      this.logger.error(`❌ No se pudo conectar a RabbitMQ (authz): ${msg}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
  }

  /**
   * Publica que los permisos de un rol (para un servicio) cambiaron.
   * `service` null = afecta a todos los servicios (ej. rol desactivado).
   */
  async publishRolePermissionsChanged(role: string, service: string | null) {
    if (!this.isConnected || !this.channel) {
      this.logger.warn('⏳ Canal authz no disponible, evento no publicado');
      return;
    }
    const payload: RolePermissionsChangedEvent = {
      event: 'role_permissions.changed',
      role,
      service,
      at: new Date().toISOString(),
    };
    try {
      this.channel.publish(
        this.exchange,
        this.routingKey,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
      );
      this.logger.debug(
        `📤 authz event: role=${role} service=${service ?? '*'}`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'desconocido';
      this.logger.error(`❌ Error publicando authz event: ${msg}`);
      this.isConnected = false;
      this.channel = null;
    }
  }

  async onModuleDestroy() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // Ignoramos errores al cerrar
    }
  }
}
