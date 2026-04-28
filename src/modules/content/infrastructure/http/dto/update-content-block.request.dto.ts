import { IsInt, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateContentBlockRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsOptional()
  @IsString()
  placementKey?: string;

  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;

  @IsOptional()
  startsAt?: string | null;

  @IsOptional()
  endsAt?: string | null;

  @IsOptional()
  @IsInt()
  priority?: number;
}
