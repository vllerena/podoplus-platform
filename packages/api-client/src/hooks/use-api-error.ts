/**
 * Extracts a human-readable error message from an openapi-fetch error response.
 */
export function getApiErrorMessage(error: unknown): string {
  if (!error) return "Error desconocido";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (typeof e["message"] === "string") return e["message"];
    if (typeof e["error"] === "string") return e["error"];
    if (Array.isArray(e["message"])) return (e["message"] as string[]).join(", ");
  }
  return "Ha ocurrido un error";
}
