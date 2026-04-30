const pad = (n: number) => String(n).padStart(2, "0");

function timestamp(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export const logger = {
  info: (ctx: string, msg: string) =>
    console.log(`[${timestamp()}] [INFO]  [${ctx}] ${msg}`),
  warn: (ctx: string, msg: string) =>
    console.warn(`[${timestamp()}] [WARN]  [${ctx}] ${msg}`),
  error: (ctx: string, msg: string, err?: unknown) => {
    const detail = err instanceof Error ? ` — ${err.message}` : "";
    console.error(`[${timestamp()}] [ERROR] [${ctx}] ${msg}${detail}`);
  },
};
