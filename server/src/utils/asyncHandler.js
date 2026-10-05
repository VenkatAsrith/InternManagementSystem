// Express 4 does not forward rejected promises to the error handler. Wrap every async controller with this.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export default ah;
