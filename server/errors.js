export class AppError extends Error {
  constructor(status, message, code = 'invalid_request') { super(message); this.status = status; this.code = code; }
}
export function requireValue(condition, message, status = 400, code) {
  if (!condition) throw new AppError(status, message, code);
}
