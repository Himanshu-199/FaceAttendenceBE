/**
 * An error that maps directly to an HTTP response.
 * `details` is merged into the JSON body, e.g. { fields: { email: '...' } } or { angle: 'left' }.
 */
export class HttpError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}
