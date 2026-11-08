const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { validateRegister, validateLogin } = require("../utils/validators");

const SALT_ROUNDS = 10;
// Compared against when the email does not exist, so "unknown email" and "wrong password" take the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", SALT_ROUNDS);

function signToken(user) {
  return jwt.sign({ sub: user.id }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

async function register(input) {
  const errors = validateRegister(input);
  if (Object.keys(errors).length) throw ApiError.validation(undefined, errors);

  try {
    // Role is NOT read from the request: everyone who registers is a customer.
    const user = await User.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
    });
    return { user: user.toJSON(), token: signToken(user) };
  } catch (err) {
    // 11000 = duplicate key: the unique email index rejected it (also catches two sign-ups at the same moment)
    if (err.code === 11000)
      throw ApiError.conflict(
        "EMAIL_TAKEN",
        "An account with this email already exists.",
      );
    throw err;
  }
}

async function login(input) {
  const errors = validateLogin(input);
  if (Object.keys(errors).length) throw ApiError.validation(undefined, errors);

  const user = await User.findOne({
    email: input.email.trim().toLowerCase(),
  }).select("+passwordHash");
  const passwordOk = await bcrypt.compare(
    input.password,
    user ? user.passwordHash : DUMMY_HASH,
  );
  if (!user || !passwordOk)
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Incorrect email or password.",
    );

  return { user: user.toJSON(), token: signToken(user) };
}

module.exports = { register, login, signToken };
