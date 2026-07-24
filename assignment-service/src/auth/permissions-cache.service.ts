import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as amqp from 'amqplib';

interface CacheEntry {
  perms: string[];
  exp: number;
}

/**
 * Autorización PULL para este microservicio:
 *  - Al necesitar los permisos de un rol, los pide a gestion-usuarios (endpoint interno)
 *    filtrados por este servicio, y los cachea en memoria con TTL.
 *  - Escucha eventos 'role_permissions.changed' por RabbitMQ para invalidar la caché
 *    cuando cambian los permisos de un rol (la caché con TTL es la red de seguridad).
 */
@Injectable()
export class PermissionsCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PermissionsCacheService.name);

  /** Id de este servicio; debe coincidir con la columna `service` de los permisos. */
  private readonly SERVICE_ID = 'assignment-service';
  private readonly TTL_MS = 5 * 60_000;

  private cache = new Map<string, CacheEntry>(); // key = nombre de rol
  private readonly internalUrl: string;
  private readonly internalKey: string;

  // RabbitMQ (consumidor de invalidación)
  private connection: any = null;
  private channel: any = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly exchange: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.internalUrl =
      this.config.get<string>('USUARIOS_INTERNAL_URL') ??
      'http://gestion-usuarios:3001/api/usuarios';
    this.internalKey = this.config.get<string>('INTERNAL_API_KEY') ?? '';
    this.exchange = this.config.get<string>('AUTHZ_EXCHANGE') ?? 'authz_exchange';
  }

  async onModuleInit() {
    await this.connectRabbit();
  }

  /**
   * Devuelve los permisos del rol para este servicio (cacheados).
   * En caso de fallo del pull, devuelve [] (deny-by-default).
   */
  async getPermissions(role: string): Promise<string[]> {
    const hit = this.cache.get(role);
    if (hit && hit.exp > Date.now()) {
      return hit.perms;
    }

    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.internalUrl}/internal/role-permissions/resolve`,
          { role, serviceId: this.SERVICE_ID },
          { headers: { 'x-internal-key': this.internalKey }, timeout: 3000 },
        ),
      );
      const perms: string[] = data?.permissions ?? [];
      this.cache.set(role, { perms, exp: Date.now() + this.TTL_MS });
      return perms;
    } catch (error: any) {
      this.logger.error(
        `No se pudieron resolver permisos de '${role}': ${error?.message}`,
      );
      return []; // deny-by-default
    }
  }

  invalidate(role: string) {
    this.cache.delete(role);
    this.logger.log(`Caché de permisos invalidada para rol '${role}'`);
  }

  invalidateAll() {
    this.cache.clear();
  }

  // ───────────────────────── RabbitMQ ─────────────────────────

  private async connectRabbit(): Promise<void> {
    const host = this.config.get('RABBITMQ_HOST');
    const port = this.config.get('RABBITMQ_PORT');
    const user = this.config.get('RABBITMQ_USER');
    const pass = this.config.get('RABBITMQ_PASSWORD');
    const url = `amqp://${user}:${pass}@${host}:${port}`;

    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

      // Cola exclusiva por instancia: cada réplica invalida su propia caché.
      const q = await this.channel.assertQueue('', { exclusive: true });
      await this.channel.bindQueue(q.queue, this.exchange, 'role_permissions.changed');

      await this.channel.consume(
        q.queue,
        (msg: any) => {
          if (!msg) return;
          try {
            const evt = JSON.parse(msg.content.toString());
            // Invalida si el evento afecta a este servicio (o a todos: service null)
            if (!evt.service || evt.service === this.SERVICE_ID) {
              this.invalidate(evt.role);
            }
          } catch (e: any) {
            this.logger.warn(`Evento authz no procesable: ${e?.message}`);
          }
        },
        { noAck: true },
      );

      this.logger.log('✅ Suscrito a eventos authz para invalidación de caché');

      this.connection.on('close', () => {
        this.channel = null;
        this.connection = null;
        this.scheduleReconnect();
      });
      this.connection.on('error', (err: any) => {
        this.logger.error(`❌ Error RabbitMQ (authz cache): ${err.message}`);
      });
    } catch (error: any) {
      this.logger.error(
        `❌ No se pudo suscribir a RabbitMQ (authz cache): ${error?.message}`,
      );
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => this.connectRabbit(), 5000);
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
