import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import {RoleusersModule} from "../roleusers/roleusers.module";


@Module({
  imports: [
    UsersModule,
    PassportModule,
    RoleusersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],  
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const privateKeyBase64 = configService.get<string>('JWT_PRIVATE_KEY');
        const privateKey = Buffer.from(privateKeyBase64!, 'base64').toString('utf-8');
        const publicKeyBase64 = configService.get<string>('JWT_PUBLIC_KEY');
        const publicKey = Buffer.from(publicKeyBase64!, 'base64').toString('utf-8');
        return {
          privateKey,
          publicKey,
          signOptions: {
            expiresIn: '15m',
             algorithm: 'RS256',
             issuer: 'tickets-auth-service',
              },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
