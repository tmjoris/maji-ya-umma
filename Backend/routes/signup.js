import express from "express";
import { rateLimit } from "express-rate-limit";
import { auth } from "../firebase.js";
import { putIfAbsent, now } from "../data/db.js";
import { EVENTS } from "../mq/config.js";
import { publishEvent } from "../mq/publisher.js";
import { ROLES, newUserItem } from "../services/profiles.js";
import { asyncHandler, HttpError, normalizeKenyanPhone, generateAccountNumber } from "../lib/util.js";

const router = express.Router();

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many sign-up attempts, please try again later" },
});

const REQUIRED = ["firstName", "lastName", "email", "phoneNumber", "idNumber", "address", "city", "password"];
const OPTIONAL = ["state", "zipCode"];

// Creates the Firebase Auth account and the profile together. Stays
// synchronous: the person filling in the form needs to hear about "email
// already registered" right away. The frontend signs in afterwards.
router.post(
  "/",
  signupLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const missing = REQUIRED.filter((f) => !String(body[f] ?? "").trim());
    if (missing.length) throw new HttpError(400, `Missing fields: ${missing.join(", ")}`);

    const tooLong = [...REQUIRED, ...OPTIONAL].filter((f) => String(body[f] ?? "").length > 200);
    if (tooLong.length) throw new HttpError(400, `Fields too long: ${tooLong.join(", ")}`);
    if (String(body.password).length < 8) throw new HttpError(400, "Password must be at least 8 characters");

    const phoneNumber = normalizeKenyanPhone(body.phoneNumber);
    if (!phoneNumber) throw new HttpError(400, "Enter a valid Kenyan phone number, e.g. 0712345678");

    const email = String(body.email).trim().toLowerCase();
    let user;
    try {
      user = await auth.createUser({
        email,
        password: String(body.password),
        displayName: `${body.firstName} ${body.lastName}`.trim(),
      });
    } catch (err) {
      if (err.code === "auth/email-already-exists") throw new HttpError(409, "An account with this email already exists");
      if (err.code === "auth/invalid-email") throw new HttpError(400, "Enter a valid email address");
      if (err.code === "auth/invalid-password") throw new HttpError(400, "Password is too weak");
      throw err;
    }

    const profile = {
      uid: user.uid,
      email,
      firstName: String(body.firstName).trim(),
      lastName: String(body.lastName).trim(),
      phoneNumber,
      idNumber: String(body.idNumber).trim(),
      address: String(body.address).trim(),
      city: String(body.city).trim(),
      state: String(body.state ?? "").trim(),
      zipCode: String(body.zipCode ?? "").trim(),
      userRole: ROLES.CUSTOMER,
      accountNumber: generateAccountNumber(),
      createdOn: now(),
    };

    try {
      if (!(await putIfAbsent(newUserItem(profile)))) throw new Error(`profile for ${user.uid} already exists`);
    } catch (err) {
      await auth.deleteUser(user.uid).catch(() => {}); // don't leave a login without a profile
      throw err;
    }

    // Best-effort: the account exists, so a broker outage must not turn a
    // successful signup into an error.
    publishEvent(EVENTS.USER_REGISTERED, { uid: user.uid }, { id: `user-registered:${user.uid}` }).catch((err) =>
      console.error(`user.registered not published for ${user.uid}: ${err.message}`)
    );

    res.status(201).json({ message: "Account created", accountNumber: profile.accountNumber });
  })
);

export default router;
