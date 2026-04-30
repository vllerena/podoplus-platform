#!/bin/sh
set -e

echo "🚀 Podoplus API — Iniciando..."
echo "   Entorno: ${NODE_ENV}"
echo "   Base de datos: ${DATABASE_URL}"

# Esperar a que Postgres esté listo
echo "⏳ Esperando a PostgreSQL..."
until npx prisma db ping --schema=./prisma/schema.prisma 2>/dev/null; do
  echo "   PostgreSQL no disponible aún, reintentando en 2s..."
  sleep 2
done
echo "✅ PostgreSQL disponible"

# Correr migraciones pendientes
echo "🔄 Aplicando migraciones..."
npx prisma migrate deploy --schema=./prisma/schema.prisma
echo "✅ Migraciones aplicadas"

# Arrancar el API
echo "▶️  Iniciando servidor NestJS..."
exec node dist/main.js
