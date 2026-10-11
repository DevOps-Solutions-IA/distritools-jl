import { IsISO8601, IsString, Length, Matches } from "class-validator";

export class ApproveProductImageRequestDto {
  @IsString()
  @Length(1, 500)
  assetPath!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  sha256!: string;

  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @IsString()
  @Length(3, 500)
  reason!: string;
}
