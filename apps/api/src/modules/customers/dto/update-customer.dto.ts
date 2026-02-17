import { IsString, IsOptional, IsEmail, Matches } from "class-validator";

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "birthDate debe tener formato YYYY-MM-DD (ej: 1990-05-15)",
  })
  birthDate?: string; // Formato: YYYY-MM-DD

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
