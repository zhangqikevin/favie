// In-memory ring buffer for recent server logs (viewable via /api/admin/logs)
const MAX_LINES = 2000;
const buffer: string[] = [];

export function pushLog(level: string, ...args: unknown[]): void {
  const ts = new Date().toISOString().slice(11, 23);
  const msg = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
  buffer.push(`${ts} [${level}] ${msg}`);
  if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES);
}

export function getLogs(last = 200): string[] {
  return buffer.slice(-last);
}

// Patch console to also capture to buffer
const origLog = console.log.bind(console);
const origWarn = console.warn.bind(console);
const origError = console.error.bind(console);

console.log = (...args: unknown[]) => { origLog(...args); pushLog("LOG", ...args); };
console.warn = (...args: unknown[]) => { origWarn(...args); pushLog("WARN", ...args); };
console.error = (...args: unknown[]) => { origError(...args); pushLog("ERR", ...args); };
