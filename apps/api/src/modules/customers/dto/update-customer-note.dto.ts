import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateCustomerNoteDto {
  @ApiProperty({
    example: "Se actualizó el diagnóstico: fasciitis plantar leve.",
    description: "Nuevo contenido de la nota clínica",
  })
  @IsString()
  @IsNotEmpty({ message: "El contenido de la nota es requerido" })
  @MinLength(3, { message: "La nota debe tener al menos 3 caracteres" })
  @MaxLength(5000, { message: "La nota no puede superar 5000 caracteres" })
  content: string;
}
