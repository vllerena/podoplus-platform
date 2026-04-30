import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCompanyDto {
  @ApiProperty({ example: "Empresa S.A.C.", description: "Razón social de la empresa" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: "RUC", description: "Tipo de documento (RUC, DNI, PASSPORT, CE, OTHER)", required: false })
  @IsOptional()
  @IsEnum(["RUC", "DNI", "PASSPORT", "CE", "OTHER"])
  documentType?: string;

  @ApiProperty({ example: "20123456789", description: "Número de documento", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  documentNumber?: string;

  @ApiProperty({ example: "Av. Lima 123", description: "Dirección fiscal", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class CreateMarketingChannelDto {
  @ApiProperty({ example: "Instagram", description: "Nombre del canal de marketing" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
