import crypto from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { emailShell, esc, sendEmail } from "@/lib/email";

/**
 * Give a client a login for the website.
 *
 * The practice creates the account; the client chooses the password. The
 * account is written with an empty passwordHash and `mustSetPassword: true`,
 * which the website's login route refuses with a MUST_SET_PASSWORD code rather
 * than a misleading "wrong password" — and the login page then offers to send
 * a fresh link. So the invite link is generous but not eternal: a bearer token
 * that never expires sitting in an inbox is an account takeover waiting to
 * happen, and because the flow never dead-ends there is no need for one.
 */

const INVITE_TTL_DAYS = 30;

function websiteUrl(): string {
  return (
    process.env.WEBSITE_URL?.replace(/\/$/, "") ||
    "https://www.echoesofbeing.co.in"
  );
}

export interface InviteResult {
  ok: boolean;
  /** True when a brand-new login was created for them. */
  accountCreated: boolean;
  /** True when they already had a working password — we sent a reset instead. */
  alreadyHadPassword: boolean;
  userId?: string;
  error?: string;
}

export async function inviteClientToPortal(
  clientId: string,
  opts: { name: string; email: string; phone?: string; dateOfBirth?: string }
): Promise<InviteResult> {
  const db = getAdminDb();
  const email = opts.email.trim().toLowerCase();

  if (!email) {
    return {
      ok: false,
      accountCreated: false,
      alreadyHadPassword: false,
      error: "This client has no email address on file.",
    };
  }

  // Reuse an existing login rather than creating a duplicate.
  const existing = await db
    .collection("community_users")
    .where("email", "==", email)
    .limit(1)
    .get();

  let userId: string;
  let accountCreated = false;
  let alreadyHadPassword = false;

  if (!existing.empty) {
    userId = existing.docs[0].id;
    const data = existing.docs[0].data();
    alreadyHadPassword = Boolean(data.passwordHash) && !data.mustSetPassword;
    await existing.docs[0].ref.update({
      clientId,
      updatedAt: new Date().toISOString(),
    });
  } else {
    const now = new Date().toISOString();
    const ref = await db.collection("community_users").add({
      email,
      displayName: opts.name.trim(),
      // Deliberately empty — the client sets this from the link.
      passwordHash: "",
      mustSetPassword: true,
      createdAt: now,
      updatedAt: now,
      isBanned: false,
      phone: opts.phone?.trim() ?? "",
      dateOfBirth: opts.dateOfBirth ?? "",
      gender: "",
      pronouns: "",
      // Terms are NOT pre-accepted on their behalf. The website prompts for
      // them when they first book, which keeps the consent genuinely theirs.
      role: "user" as const,
      clientId,
      invitedAt: now,
    });
    userId = ref.id;
    accountCreated = true;
  }

  // Link the clinical file back to the login.
  await db.collection("clients").doc(clientId).update({ userId });

  // One-time token, consumed by the website's existing reset-password route.
  const rawToken = crypto.randomUUID();
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await db.collection("password_reset_tokens").add({
    userId,
    tokenHash,
    kind: "invite",
    expiresAt: new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString(),
    used: false,
    createdAt: new Date().toISOString(),
  });

  const link = `${websiteUrl()}/auth/reset-password?token=${rawToken}`;
  const firstName = opts.name.trim().split(" ")[0] || "there";

  const sent = await sendEmail({
    to: email,
    subject: alreadyHadPassword
      ? "Your Echoes of Being account"
      : "Set up your Echoes of Being account",
    html: emailShell(`
      <h1 style="font-family:Georgia,serif;font-size:22px;color:#2d352d;margin:0 0 16px;">
        ${alreadyHadPassword ? "Your account" : "Welcome"}
      </h1>
      <p style="color:#5a615a;font-size:15px;line-height:1.7;margin:0 0 18px;">
        Hi ${esc(firstName)}, ${
          alreadyHadPassword
            ? "you already have an account with us. If you'd like to change your password, use the link below."
            : "we've set up an account for you so you can see your sessions, book new ones, and make changes when you need to."
        }
      </p>
      <p style="color:#5a615a;font-size:15px;line-height:1.7;margin:0 0 24px;">
        ${
          alreadyHadPassword
            ? "Otherwise you can ignore this email."
            : "Choose a password to get started."
        }
      </p>
      <p style="margin:0 0 24px;">
        <a href="${esc(link)}"
           style="display:inline-block;background:#5c7a5c;color:#faf7f0;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:15px;">
          ${alreadyHadPassword ? "Change my password" : "Set my password"}
        </a>
      </p>
      <p style="color:#8a8f87;font-size:13px;line-height:1.7;margin:0;">
        This link works for the next ${INVITE_TTL_DAYS} days. If it expires, go to
        the login page and choose &ldquo;Forgot password&rdquo; and we&apos;ll send a fresh one.
      </p>
    `),
  });

  if (!sent) {
    return {
      ok: false,
      accountCreated,
      alreadyHadPassword,
      userId,
      error:
        "The account is ready but the email could not be sent. Check RESEND_API_KEY.",
    };
  }

  return { ok: true, accountCreated, alreadyHadPassword, userId };
}
