import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignRoleToUserRequestDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;
}
