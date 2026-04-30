/**
 * Script para hashear contraseñas
 * Uso: node hash-password.js
 */

const { scryptSync, randomBytes } = require("crypto");

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hashedPassword = scryptSync(password, salt, 64).toString("hex");
  return `${salt}.${hashedPassword}`;
}

// Hashea la contraseña
const password = "password123";
const hash = hashPassword(password);

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║  PASSWORD HASHER - Podoplus Auth                           ║");
console.log("╠════════════════════════════════════════════════════════════╣");
console.log(`║  Password: ${password.padEnd(45)}║`);
console.log(`║  Hash: ${hash.substring(0, 54)}║`);
if (hash.length > 54) {
  console.log(`║        ${hash.substring(54).padEnd(54)}║`);
}
console.log("╠════════════════════════════════════════════════════════════╣");
console.log("║  Copia el hash anterior y pégalo en passwordHash del user  ║");
console.log("║  en Prisma Studio                                          ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// También imprime solo el hash para copiar fácilmente
console.log("HASH PARA COPIAR:");
console.log(hash);
