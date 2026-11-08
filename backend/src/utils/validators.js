const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegister(input) {
  const errors = {};
  if (typeof input.name !== "string" || input.name.trim().length < 2)
    errors.name = "Please enter your full name.";
  if (typeof input.email !== "string" || !EMAIL_RE.test(input.email.trim()))
    errors.email = "Please enter a valid email address.";
  if (typeof input.password !== "string" || input.password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  else if (input.password.length > 72)
    errors.password = "Password must be at most 72 characters."; // bcrypt limit
  return errors;
}

function validateLogin(input) {
  const errors = {};
  if (typeof input.email !== "string" || !input.email.trim())
    errors.email = "Please enter your email.";
  if (typeof input.password !== "string" || !input.password)
    errors.password = "Please enter your password.";
  return errors;
}

module.exports = { EMAIL_RE, validateRegister, validateLogin };
