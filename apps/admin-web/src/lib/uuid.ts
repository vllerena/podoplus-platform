/**
 * Genera un UUID v4 compatible con contextos no-seguros (HTTP sin TLS).
 *
 * `crypto.randomUUID()` solo está disponible en "secure contexts" (HTTPS o
 * localhost). En producción sobre HTTP puro, la función no existe y lanza
 * TypeError. Este helper usa `crypto.randomUUID()` cuando está disponible y
 * recurre a una implementación manual basada en `Math.random()` como fallback.
 */
export function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof (crypto as Crypto).randomUUID === "function"
  ) {
    return (crypto as Crypto).randomUUID();
  }

  // Fallback: RFC 4122 version 4 UUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
