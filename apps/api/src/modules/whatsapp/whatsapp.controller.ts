import {
  Controller, Get, Post, Body, UseGuards,
  HttpCode, HttpStatus, Logger, BadRequestException,
} from "@nestjs/common";
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
} from "@nestjs/swagger";
import { WhatsappLogService, WhatsappLogEntry } from "./whatsapp-log.service";
import { SendWhatsappDto } from "./dto/send-whatsapp.dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";

// ── Templates disponibles ─────────────────────────────────────────────────────

interface WhatsappTemplate {
  name:         string;
  displayName:  string;
  description:  string;
  preview:      string;
  variables:    { index: number; label: string; example: string }[];
}

const WHATSAPP_TEMPLATES: WhatsappTemplate[] = [
  {
    name:        "appointment_reminder",
    displayName: "Recordatorio de cita",
    description: "Recuerda al cliente su próxima cita",
    preview:     "Hola {{1}}, te recordamos que tienes una cita el {{2}} para {{3}} en {{4}}. ¡Te esperamos!",
    variables: [
      { index: 1, label: "Nombre del cliente",   example: "María García" },
      { index: 2, label: "Fecha y hora",          example: "25 de abril, 10:00 AM" },
      { index: 3, label: "Servicio",              example: "Podología clínica" },
      { index: 4, label: "Sede",                  example: "Podoplus San Isidro" },
    ],
  },
  {
    name:        "appointment_confirmation",
    displayName: "Confirmación de cita",
    description: "Confirma una cita agendada",
    preview:     "Hola {{1}}, tu cita para {{3}} el {{2}} en {{4}} ha sido confirmada. Si necesitas cambiarla, contáctanos.",
    variables: [
      { index: 1, label: "Nombre del cliente",   example: "Carlos López" },
      { index: 2, label: "Fecha y hora",          example: "26 de abril, 3:00 PM" },
      { index: 3, label: "Servicio",              example: "Uñas encarnadas" },
      { index: 4, label: "Sede",                  example: "Podoplus Miraflores" },
    ],
  },
  {
    name:        "appointment_cancellation",
    displayName: "Cancelación de cita",
    description: "Notifica la cancelación de una cita",
    preview:     "Hola {{1}}, tu cita para {{3}} el {{2}} ha sido cancelada. Puedes reagendar cuando desees.",
    variables: [
      { index: 1, label: "Nombre del cliente",   example: "Ana Torres" },
      { index: 2, label: "Fecha y hora",          example: "27 de abril, 11:00 AM" },
      { index: 3, label: "Servicio",              example: "Tratamiento de hongos" },
    ],
  },
  {
    name:        "appointment_reschedule",
    displayName: "Reprogramación de cita",
    description: "Notifica que la cita fue reprogramada",
    preview:     "Hola {{1}}, tu cita para {{3}} ha sido reprogramada al {{2}} en {{4}}.",
    variables: [
      { index: 1, label: "Nombre del cliente",   example: "Pedro Ramos" },
      { index: 2, label: "Nueva fecha y hora",    example: "28 de abril, 9:00 AM" },
      { index: 3, label: "Servicio",              example: "Plantillas ortopédicas" },
      { index: 4, label: "Sede",                  example: "Podoplus San Borja" },
    ],
  },
  {
    name:        "welcome",
    displayName: "Bienvenida al cliente",
    description: "Mensaje de bienvenida para nuevos clientes",
    preview:     "¡Hola {{1}}! Bienvenido a {{2}}. Estamos felices de tenerte como cliente. ¡Hasta pronto!",
    variables: [
      { index: 1, label: "Nombre del cliente",   example: "Roberto Silva" },
      { index: 2, label: "Nombre de la sede",     example: "Podoplus San Isidro" },
    ],
  },
];

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags("WhatsApp")
@ApiBearerAuth("access-token")
@Controller("v1/whatsapp")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WhatsappController {
  private readonly logger = new Logger("WhatsappController");

  constructor(private readonly whatsappLogService: WhatsappLogService) {}

  /**
   * GET /v1/whatsapp/templates
   * Lista de templates disponibles con sus variables y previsualización.
   */
  @Get("templates")
  @RequirePermission("whatsapp.read")
  @ApiOperation({ summary: "Lista de templates WhatsApp disponibles" })
  @ApiResponse({ status: 200, description: "Array de templates" })
  getTemplates(): WhatsappTemplate[] {
    return WHATSAPP_TEMPLATES;
  }

  /**
   * POST /v1/whatsapp/messages
   * Envío manual simulado de un mensaje WhatsApp.
   * En modo simulado: registra en DB + log de archivo, no llama la API de Meta.
   * Cuando WHATSAPP_ACCESS_TOKEN esté configurado, aquí se añadirá la llamada real.
   */
  @Post("messages")
  @RequirePermission("whatsapp.read")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Enviar mensaje WhatsApp (simulado)" })
  @ApiResponse({ status: 201, description: "Mensaje registrado como SIMULATED" })
  @ApiResponse({ status: 400, description: "Payload inválido" })
  sendMessage(@Body() dto: SendWhatsappDto) {
    // Validación adicional de negocio
    if (dto.messageType === "TEMPLATE" && !dto.templateName) {
      throw new BadRequestException(
        "templateName es requerido cuando messageType es TEMPLATE",
      );
    }
    if (dto.messageType === "TEXT" && !dto.messageBody) {
      throw new BadRequestException(
        "messageBody es requerido cuando messageType es TEXT",
      );
    }

    const preview = this.buildMessageBody(dto);

    const entry: WhatsappLogEntry = {
      timestamp:       new Date().toISOString(),
      recipientPhone:  dto.toPhone,
      messageType:     dto.messageType,
      templateName:    dto.templateName,
      variables:       dto.variables,
      messageBody:     preview,
      status:          "SIMULATED",
      customerId:      dto.customerId,
      appointmentId:   dto.appointmentId,
      branchId:        dto.branchId,
    };

    this.whatsappLogService.logMessage(entry);
    this.logger.log(
      `Envío manual simulado → ${dto.toPhone} | tipo=${dto.messageType}` +
      (dto.templateName ? ` | template=${dto.templateName}` : ""),
    );

    return {
      status:    "SIMULATED",
      message:   "Mensaje registrado correctamente en modo simulado",
      recipient: dto.toPhone,
      preview,
      timestamp: entry.timestamp,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Construye el cuerpo del mensaje:
   * - TEXT: usa messageBody tal cual.
   * - TEMPLATE: toma el preview del template y sustituye {{n}} con las variables.
   */
  private buildMessageBody(dto: SendWhatsappDto): string {
    if (dto.messageType === "TEXT") return dto.messageBody ?? "";

    const template = WHATSAPP_TEMPLATES.find((t) => t.name === dto.templateName);
    if (!template) return dto.templateName ?? "";

    let body = template.preview;
    if (dto.variables) {
      for (const [k, v] of Object.entries(dto.variables)) {
        body = body.replaceAll(`{{${k}}}`, v);
      }
    }
    return body;
  }
}
