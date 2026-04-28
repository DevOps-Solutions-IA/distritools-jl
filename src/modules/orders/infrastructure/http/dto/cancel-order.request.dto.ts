import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelOrderRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
