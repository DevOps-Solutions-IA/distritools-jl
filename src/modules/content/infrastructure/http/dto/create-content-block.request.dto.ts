import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsInt,
} from 'class-validator';

export class CreateContentBlockRequestDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsEnum(['banner', 'hero', 'text_section', 'featured_brand'])
  type!: 'banner' | 'hero' | 'text_section' | 'featured_brand';

  @IsString()
  @IsNotEmpty()
  placementKey!: string;

  @IsObject()
  body!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  startsAt?: string | null;

  @IsOptional()
  endsAt?: string | null;

  @IsOptional()
  @IsInt()
  priority?: number;
}
