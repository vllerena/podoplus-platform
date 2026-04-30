import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AssignRoleDto {
  @ApiProperty({ example: "PODOLOGIST", description: "Código del rol a asignar" })
  @IsString()
  @IsNotEmpty({ message: "role_code es requerido" })
  role_code: string;

  @ApiProperty({ example: "clx1234abcd", description: "ID de la sede (opcional, para roles con alcance de sede)", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "branch_id no puede ser una cadena vacía" })
  branch_id?: string;
}
