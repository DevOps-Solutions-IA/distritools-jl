import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class ReindexSearchRequestDto {
  @ApiPropertyOptional({ type: [String], maxItems: 1000 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID(undefined, { each: true })
  ids?: string[];
}
