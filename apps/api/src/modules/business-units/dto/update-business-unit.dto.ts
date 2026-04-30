import { IsBoolean, IsEmail, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class UpdateBusinessUnitDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(11)
  ruc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sunatEndpoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sunatToken?: string;
}
