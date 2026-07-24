import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResolvePermissionsDto {
  @ApiProperty({
    description: 'Nombre del rol cuyos permisos se resuelven',
    example: 'ADMIN',
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    description: 'Id del microservicio consumidor que solicita los permisos',
    example: 'zonas-service',
  })
  @IsString()
  @IsNotEmpty()
  serviceId: string;
}
