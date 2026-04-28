import {
  IsArray,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdatePromotionRequestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsNumberString()
  value?: string;

  @IsOptional()
  @IsNumberString()
  minSubtotal?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  minQuantity?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetIds?: string[];

  @IsOptional()
  startsAt?: string | null;

  @IsOptional()
  endsAt?: string | null;
}
