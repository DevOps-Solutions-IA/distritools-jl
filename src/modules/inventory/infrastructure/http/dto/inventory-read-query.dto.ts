import { Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class InventoryReadQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value)
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class InventoryCountLineDto {
  @IsUUID()
  variantId!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  countedQuantity!: number;
}

export class UpdateInventoryCountLinesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => InventoryCountLineDto)
  lines!: InventoryCountLineDto[];
}
