import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class UpdateCategoryTreeRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder!: number;
}
