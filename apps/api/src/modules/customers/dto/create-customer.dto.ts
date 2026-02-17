import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  Matches,
} from "class-validator";

export class CreateCustomerDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string; // Único si se proporciona

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

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @IsOptional()
  @IsString()
  familyHeadId?: string;
}
