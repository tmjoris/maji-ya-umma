// Grants or revokes the admin role. The first admin has to be created this
// way; after that, admins can manage roles from the Users page.
//
//   npm run set-role -- someone@example.com admin
//   npm run set-role -- someone@example.com user
import { auth } from "../firebase.js";
import { K, get, update, putIfAbsent, now } from "../data/db.js";
import { ROLES, newUserItem } from "../services/profiles.js";

const [email, role] = process.argv.slice(2);
if (!email || ![ROLES.ADMIN, ROLES.CUSTOMER].includes(role)) {
  console.error("Usage: npm run set-role -- <email> <admin|user>");
  process.exit(1);
}

try {
  const user = await auth.getUserByEmail(email);
  if (await get(K.user(user.uid))) {
    await update(K.user(user.uid), { set: { userRole: role } });
  } else {
    await putIfAbsent(newUserItem({ uid: user.uid, email: user.email, firstName: user.displayName ?? "", userRole: role, createdOn: now() }));
  }
  console.log(`${email} is now ${role}`);
  process.exit(0);
} catch (err) {
  console.error(err.code === "auth/user-not-found" ? `No account for ${email}` : err.message);
  process.exit(1);
}
