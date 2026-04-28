import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, NotEquals } from 'class-validator';

export class AdjustStockRequestDto {
  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiProperty()
  @IsInt()
  @NotEquals(0)
  quantityDelta!: number;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiProperty()
  @IsString()
  referenceId!: string;
}
