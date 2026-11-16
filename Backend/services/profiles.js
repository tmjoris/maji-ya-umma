import { K, get, clean } from "../data/db.js";
import { serialize } from "../lib/util.js";

export const ROLES = { CUSTOMER: "user", ADMIN: "admin" };

// Profiles are stored at USER#<uid>. (Profiles from the Firestore era are
// copied over by scripts/migrate-from-firestore.js.)
export async function loadProfile({ uid }) {
  const item = await get(K.user(uid));
  return item ? { id: uid, ...clean(item) } : null;
}

// A new profile item, with the index keys used to list all users.
export function newUserItem(profile) {
  return {
    ...K.user(profile.uid),
    entity: "user",
    gsi2pk: "USERS",
    gsi2sk: profile.uid,
    version: 0,
    openBills: [],
    balance: 0,
    meterNumbers: [],
    ...profile,
  };
}

// What a customer may see about themselves / what admins see in lists.
export function publicProfile(p) {
  return serialize({
    uid: p.uid ?? p.id,
    email: p.email,
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    phoneNumber: p.phoneNumber ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    zipCode: p.zipCode ?? "",
    userRole: p.userRole ?? ROLES.CUSTOMER,
    accountNumber: p.accountNumber ?? null,
    balance: p.balance ?? 0,
    meterNumbers: p.meterNumbers ?? [],
    lastPaymentAt: p.lastPaymentAt ?? null,
    lastPaymentAmount: p.lastPaymentAmount ?? null,
    createdOn: p.createdOn ?? null,
  });
}

export const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ") || p?.email || "Customer";
