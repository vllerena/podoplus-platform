import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from "class-validator";

export class CreateBranchDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  defaultCapacity: number;

  @IsString()
  timezone: string;
}
