import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonasService } from './personas.service';
import { PersonasController } from './personas.controller';
import { InternalPersonasController } from './internal-personas.controller';
import { Persona } from './entities/persona.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { RoleusersModule } from 'src/roleusers/roleusers.module';
import { InternalKeyGuard } from 'src/auth/guards/internal-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Persona, User]),
    UsersModule,
    AuthModule,
    RoleusersModule
  ],
  controllers: [PersonasController, InternalPersonasController],
  providers: [PersonasService, InternalKeyGuard],
  exports: [PersonasService],
})
export class PersonasModule {}
