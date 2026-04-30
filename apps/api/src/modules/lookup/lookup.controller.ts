/**
 * lookup.controller.ts
 *
 * Endpoints de consulta a servicios externos de identificación:
 *  - GET /v1/lookup/dni/:documentNumber  → RENIEC vía apiperu.dev
 *
 * Se expone como utilidad reutilizable para registrar pacientes,
 * empleados u otras entidades que requieran datos del DNI.
 */
import {
  Controller,
  Get,
  Param,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";

const APIPERU_TOKEN =
  "be5105220503a6a112813103e69340826f3d994644a5ebfc2bb9f5a3998033f1";
const APIPERU_BASE  = "https://apiperu.dev/api";

export interface DniLookupResult {
  documentNumber: string;
  firstName:      string;
  lastName:       string;
  fullName:       string;
}

export interface RucLookupResult {
  documentNumber: string;
  name:           string;
  address:        string | null;
  state?:         string;
  condition?:     string;
}

@ApiTags("lookup")
@UseGuards(JwtAuthGuard)
@Controller("v1/lookup")
export class LookupController {
  private readonly logger = new Logger("LookupController");

  @Get("dni/:documentNumber")
  @ApiOperation({ summary: "Consultar datos del DNI en RENIEC vía apiperu.dev" })
  @ApiParam({ name: "documentNumber", example: "72492353", description: "Número de DNI (8 dígitos)" })
  async getDni(
    @Param("documentNumber") documentNumber: string,
  ): Promise<DniLookupResult> {
    if (!/^\d{8}$/.test(documentNumber)) {
      throw new BadRequestException("El DNI debe tener exactamente 8 dígitos numéricos");
    }

    let body: any;
    try {
      const res = await fetch(`${APIPERU_BASE}/dni/${documentNumber}`, {
        method:  "GET",
        headers: {
          "Authorization": `Bearer ${APIPERU_TOKEN}`,
          "Content-Type":  "application/json",
          "Accept":        "application/json",
        },
      });

      if (!res.ok) {
        this.logger.warn(`apiperu.dev respuesta ${res.status} para DNI ${documentNumber}`);
        throw new InternalServerErrorException("No se pudo consultar el DNI en RENIEC");
      }

      body = await res.json();
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) throw err;
      this.logger.error(`Error al consultar DNI ${documentNumber}: ${err.message}`);
      throw new InternalServerErrorException("Error de conexión al consultar RENIEC");
    }

    if (!body?.success || !body?.data) {
      throw new BadRequestException(`DNI ${documentNumber} no encontrado en RENIEC`);
    }

    const data = body.data;
    const firstName = this.titleCase(data.nombres ?? "");
    const lastName  = this.titleCase(
      [data.apellido_paterno, data.apellido_materno].filter(Boolean).join(" ")
    );

    return {
      documentNumber,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
    };
  }

  @Get("ruc/:ruc")
  @ApiOperation({ summary: "Consultar datos del RUC en SUNAT vía apiperu.dev" })
  @ApiParam({ name: "ruc", example: "20601234567", description: "Número de RUC (11 dígitos)" })
  async getRuc(@Param("ruc") ruc: string): Promise<RucLookupResult> {
    if (!/^\d{11}$/.test(ruc)) {
      throw new BadRequestException("El RUC debe tener exactamente 11 dígitos numéricos");
    }

    let body: any;
    try {
      const res = await fetch(`${APIPERU_BASE}/ruc/${ruc}`, {
        method:  "GET",
        headers: {
          "Authorization": `Bearer ${APIPERU_TOKEN}`,
          "Content-Type":  "application/json",
          "Accept":        "application/json",
        },
      });

      if (!res.ok) {
        this.logger.warn(`apiperu.dev respuesta ${res.status} para RUC ${ruc}`);
        throw new InternalServerErrorException("No se pudo consultar el RUC en SUNAT");
      }

      body = await res.json();
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) throw err;
      this.logger.error(`Error al consultar RUC ${ruc}: ${err.message}`);
      throw new InternalServerErrorException("Error de conexión al consultar SUNAT");
    }

    if (!body?.success || !body?.data) {
      throw new BadRequestException(`RUC ${ruc} no encontrado en SUNAT`);
    }

    const data = body.data;
    return {
      documentNumber: ruc,
      name:           this.titleCase(data.nombre_o_razon_social ?? ""),
      address:        data.direccion ? this.titleCase(data.direccion) : null,
      state:          data.estado,
      condition:      data.condicion,
    };
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  private titleCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
