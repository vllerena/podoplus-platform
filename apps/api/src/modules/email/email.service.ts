import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import { writeEmailLog, EmailLogEntry } from "./email-log";

// ── Preset de Mailtrap Sandbox ────────────────────────────────────────────────
// Documentación: https://mailtrap.io/inboxes → SMTP Settings
const MAILTRAP_SMTP = {
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  secure: false,
  tls: true, // rejectUnauthorized: false para evitar errores de cert en sandbox
} as const;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  /** Identificador del proveedor activo, solo para logging. */
  private readonly providerLabel: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>(
      "MAIL_FROM",
      "no-reply@podoplus.pe",
    );

    const provider = this.configService.get<string>("MAIL_PROVIDER", "smtp");

    if (provider === "mailtrap") {
      // ── Mailtrap Sandbox ────────────────────────────────────────────────────
      const user = this.configService.get<string>("MAILTRAP_USER");
      const pass = this.configService.get<string>("MAILTRAP_PASS");

      if (!user || !pass) {
        this.transporter = null;
        this.providerLabel = "log-only (mailtrap sin credenciales)";
        this.logger.warn(
          "MAIL_PROVIDER=mailtrap pero MAILTRAP_USER / MAILTRAP_PASS no están configurados — " +
          "corriendo en modo log-only.",
        );
      } else {
        this.transporter = nodemailer.createTransport({
          host:   MAILTRAP_SMTP.host,
          port:   MAILTRAP_SMTP.port,
          secure: MAILTRAP_SMTP.secure,
          auth: { user, pass },
          tls:  MAILTRAP_SMTP.tls ? { rejectUnauthorized: false } : undefined,
        });
        this.providerLabel = `mailtrap (${MAILTRAP_SMTP.host}:${MAILTRAP_SMTP.port})`;
        this.logger.log(`Email: usando Mailtrap Sandbox — inbox visible en https://mailtrap.io`);
      }
    } else {
      // ── SMTP genérico ────────────────────────────────────────────────────────
      const host   = this.configService.get<string>("MAIL_HOST");
      const port   = this.configService.get<number>("MAIL_PORT");
      const user   = this.configService.get<string>("MAIL_USER");
      const pass   = this.configService.get<string>("MAIL_PASS");
      const secure = this.configService.get<boolean>("MAIL_SECURE", false);
      const tls    = this.configService.get<boolean>("MAIL_TLS",    false);

      if (!host || !port || !user || !pass) {
        this.transporter = null;
        this.providerLabel = "log-only (smtp sin configurar)";
        this.logger.debug(
          "Configuración de correo incompleta — corriendo en modo log-only " +
          "(los emails se registran localmente en vez de enviarse).",
        );
      } else {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          tls: tls ? { rejectUnauthorized: false } : undefined,
        });
        this.providerLabel = `smtp (${host}:${port})`;
        this.logger.log(`Email: usando SMTP ${host}:${port}`);
      }
    }
  }

  // ── Core: send ───────────────────────────────────────────────────────────────

  async sendMail(options: SendMailOptions): Promise<void> {
    if (!options.from) options.from = this.from;

    const logEntry: EmailLogEntry = {
      to:        options.to as string | string[],
      from:      options.from,
      subject:   options.subject ?? "",
      text:      options.text,
      html:      options.html,
      status:    "LOGGED",
      createdAt: new Date().toISOString(),
    };

    if (!this.transporter) {
      await writeEmailLog(logEntry);
      this.logger.log(`[${this.providerLabel}] Email registrado localmente → ${options.to}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail(options);
      logEntry.status    = "SENT";
      logEntry.messageId = info.messageId;
      await writeEmailLog(logEntry);
      this.logger.log(
        `[${this.providerLabel}] Email enviado: ${info.messageId} → ${options.to}`,
      );
    } catch (error) {
      logEntry.status       = "FAILED";
      logEntry.errorMessage = (error as Error).message;
      await writeEmailLog(logEntry);
      this.logger.error(
        `[${this.providerLabel}] Error al enviar email → ${options.to}`,
        error as Error,
      );
      throw new InternalServerErrorException(
        "No se pudo enviar el email. Intenta de nuevo más tarde.",
      );
    }
  }

  // ── Helpers de alto nivel ────────────────────────────────────────────────────

  async sendTransactionalEmail(
    to: string | string[],
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    await this.sendMail({ to, subject, text, html });
  }

  async sendPasswordResetEmail(
    email: string,
    resetUrl: string,
    recipientName?: string,
  ): Promise<void> {
    const subject   = "Restablece tu contraseña en Podoplus";
    const firstname = recipientName?.trim() || "Usuario";

    const text =
      `Hola ${firstname},\n\n` +
      `Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Podoplus. ` +
      `Utiliza el siguiente enlace para continuar:\n\n${resetUrl}\n\n` +
      `Si no solicitaste este cambio, puedes ignorar este mensaje y tu contraseña permanecerá igual.\n\n` +
      `Saludos,\nEquipo Podoplus`;

    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Restablecer contraseña</title>
        </head>
        <body style="margin:0;padding:0;background:#f4f7fb;color:#344054;font-family:Arial,Helvetica,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td align="center" style="padding:24px;">
                <table width="600" cellpadding="0" cellspacing="0" role="presentation"
                  style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
                  <tr>
                    <td style="padding:32px;text-align:center;background:#0f172a;color:#ffffff;">
                      <h1 style="margin:0;font-size:24px;">Podoplus</h1>
                      <p style="margin:8px 0 0;font-size:14px;line-height:1.6;">Restablecimiento de contraseña</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px;">
                      <p style="margin:0 0 16px;font-size:16px;line-height:1.75;">Hola ${firstname},</p>
                      <p style="margin:0 0 24px;font-size:16px;line-height:1.75;">
                        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Podoplus.
                        Haz clic en el botón de abajo para continuar.
                      </p>
                      <p style="text-align:center;margin:0 0 24px;">
                        <a href="${resetUrl}"
                          style="display:inline-block;padding:14px 24px;background:#2563eb;color:#ffffff;
                                 text-decoration:none;border-radius:10px;font-weight:600;">
                          Restablecer contraseña
                        </a>
                      </p>
                      <p style="margin:0 0 24px;font-size:14px;line-height:1.75;color:#667085;">
                        Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
                      </p>
                      <p style="margin:0 0 24px;font-size:14px;line-height:1.75;color:#1d4ed8;word-break:break-all;">
                        <a href="${resetUrl}" style="color:#1d4ed8;text-decoration:underline;">${resetUrl}</a>
                      </p>
                      <p style="margin:0;font-size:14px;line-height:1.75;color:#667085;">
                        Si no solicitaste este cambio, ignora este mensaje y tu contraseña permanecerá igual.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 32px 32px;color:#667085;font-size:13px;line-height:1.75;">
                      <p style="margin:0;">Equipo Podoplus</p>
                      <p style="margin:8px 0 0;">Si necesitas ayuda, responde a este correo.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    await this.sendMail({ to: email, subject, text, html });
  }
}
