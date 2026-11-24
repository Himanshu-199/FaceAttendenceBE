const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const EMP_ID_RE = /^[A-Z0-9-]{2,20}$/;

/**
 * Normalizes registration fields (username/email lowercase, empId uppercase) so uniqueness
 * is case-insensitive, and returns per-field error messages.
 */
export function validateRegistration(body = {}) {
  const values = {
    username: String(body.username ?? '').trim().toLowerCase(),
    email: String(body.email ?? '').trim().toLowerCase(),
    empId: String(body.empId ?? '').trim().toUpperCase(),
  };

  const fields = {};
  if (!USERNAME_RE.test(values.username)) {
    fields.username = 'Use 3–30 characters: letters, numbers, dot, underscore or hyphen.';
  }
  if (values.email.length > 254 || !EMAIL_RE.test(values.email)) {
    fields.email = 'Enter a valid email address.';
  }
  if (!EMP_ID_RE.test(values.empId)) {
    fields.empId = 'Use 2–20 characters: letters, numbers or hyphen.';
  }

  return { values, fields };
}
