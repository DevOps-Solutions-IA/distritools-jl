import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePromotionRequestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsEnum(['percentage', 'fixed_amount'])
  type!: 'percentage' | 'fixed_amount';

  @IsEnum(['line', 'cart'])
  scope!: 'line' | 'cart';

  @IsEnum(['exclusive', 'stackable_same_scope', 'stackable_cross_scope'])
  stackingMode!: 'exclusive' | 'stackable_same_scope' | 'stackable_cross_scope';

  @IsInt()
  priority!: number;

  @IsNumberString()
  value!: string;

  @IsOptional()
  @IsNumberString()
  minSubtotal?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  minQuantity?: number | null;

  @IsEnum(['all', 'product', 'variant', 'category', 'brand'])
  targetType!: 'all' | 'product' | 'variant' | 'category' | 'brand';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetIds?: string[];

  @IsOptional()
  startsAt?: string | null;

  @IsOptional()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
