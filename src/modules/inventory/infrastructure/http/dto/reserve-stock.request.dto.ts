import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReserveStockLineRequestDto {
  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ReserveStockRequestDto {
  @ApiProperty()
  @IsString()
  referenceType!: string;

  @ApiProperty()
  @IsString()
  referenceId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ type: [ReserveStockLineRequestDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReserveStockLineRequestDto)
  lines!: ReserveStockLineRequestDto[];
}
