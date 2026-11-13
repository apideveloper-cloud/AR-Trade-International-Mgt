// Last resort: body-parser / routing errors as JSON, never an HTML stack trace.
export function jsonErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status === 400 ? 'Invalid request' : status === 413 ? 'Request is too large' : status >= 500 ? 'Server error' : err.message });
}
