import "./env.js";
import { readFileSync } from "node:fs";
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Firebase is only used for sign-in (Firebase Authentication). All data lives
// in DynamoDB (see data/).
//
// Credentials, in order of preference:
//   FIREBASE_SERVICE_ACCOUNT_FILE=/path/to/service-account.json
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
// With FIREBASE_AUTH_EMULATOR_HOST set, no credentials are needed.
const projectId = process.env.FIREBASE_PROJECT_ID || "maji-ya-umma";

function credential() {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) return undefined;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
    return cert(JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, "utf8")));
  }
  return applicationDefault();
}

const cred = credential();
export const firebaseApp = initializeApp({ projectId, ...(cred ? { credential: cred } : {}) });
export const auth = getAuth(firebaseApp);
