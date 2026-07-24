import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SelectRoleDto {
  @ApiProperty({
    description: 'Nombre del rol seleccionado por el usuario',
    example: 'ADMIN',
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}
