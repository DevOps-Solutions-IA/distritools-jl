import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class GuestCheckoutCustomerDto {
  @ApiProperty()
  @IsString()
  fullName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  document?: string;
}

class GuestCheckoutShippingAddressDto {
  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class GuestCheckoutItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateGuestCheckoutOrderRequestDto {
  @ApiProperty({ type: GuestCheckoutCustomerDto })
  @ValidateNested()
  @Type(() => GuestCheckoutCustomerDto)
  customer!: GuestCheckoutCustomerDto;

  @ApiProperty({ type: GuestCheckoutShippingAddressDto })
  @ValidateNested()
  @Type(() => GuestCheckoutShippingAddressDto)
  shippingAddress!: GuestCheckoutShippingAddressDto;

  @ApiProperty({ type: [GuestCheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GuestCheckoutItemDto)
  items!: GuestCheckoutItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
