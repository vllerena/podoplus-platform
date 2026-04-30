import { EmailService } from "../modules/email/email.service";

const config = {
  get(key: string) {
    const env: Record<string, string | undefined> = {
      MAIL_HOST: process.env.MAIL_HOST,
      MAIL_PORT: process.env.MAIL_PORT,
      MAIL_USER: process.env.MAIL_USER,
      MAIL_PASS: process.env.MAIL_PASS,
      MAIL_FROM: process.env.MAIL_FROM,
      MAIL_SECURE: process.env.MAIL_SECURE,
      MAIL_TLS: process.env.MAIL_TLS,
    };

    const value = env[key];
    if (key === "MAIL_PORT") {
      return value ? Number(value) : undefined;
    }
    if (key === "MAIL_SECURE" || key === "MAIL_TLS") {
      return value === "true";
    }
    return value;
  },
};

async function main() {
  const service = new EmailService(config as any);
  const resetUrl = "https://podoplus.pe/reset-password?token=test-token-123";
  await service.sendPasswordResetEmail(
    "test@example.com",
    resetUrl,
    "Prueba Mailtrap",
  );
  console.log("Email de prueba enviado a MailTrap");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
