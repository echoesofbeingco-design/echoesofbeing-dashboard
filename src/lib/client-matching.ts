import type { Firestore } from "firebase-admin/firestore";

/**
 * Finding an existing client before creating a new one.
 *
 * A person is identified by email OR phone — someone may book once with a
 * personal address and later be entered by the therapist with a work address,
 * or vice versa. Matching on email alone quietly created duplicate client
 * records, which split a person's clinical history across two files.
 */

/** Strip spaces, dashes, brackets and leading +91 / 91 / 0. */
export function sanitizePhone(raw: string): string {
  return String(raw ?? "")
    .replace(/[\s\-().]/g, "")
    .replace(/^(\+91|91|0)/, "");
}

export interface ClientIdentity {
  name: string;
  email: string;
  whatsapp: string;
  age?: string;
  gender?: string;
  pronouns?: string;
}

export interface MatchResult {
  clientId: string;
  created: boolean;
  matchedBy: "email" | "phone" | null;
}

/**
 * Look for an existing client by email, then by phone.
 *
 * Phone is checked against both the normalised 10-digit form (what we store
 * now) and the raw string, because older records were saved with whatever
 * formatting was typed in.
 */
export async function findExistingClient(
  db: Firestore,
  email: string,
  whatsapp: string
): Promise<{ id: string; matchedBy: "email" | "phone" } | null> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = sanitizePhone(whatsapp);
  const rawPhone = String(whatsapp ?? "").trim();

  if (cleanEmail) {
    const byEmail = await db
      .collection("clients")
      .where("email", "==", cleanEmail)
      .limit(1)
      .get();
    if (!byEmail.empty) return { id: byEmail.docs[0].id, matchedBy: "email" };
  }

  // Try the normalised phone, then the raw one for legacy records.
  for (const candidate of [cleanPhone, rawPhone]) {
    if (!candidate || candidate.length < 6) continue;
    const byPhone = await db
      .collection("clients")
      .where("whatsapp", "==", candidate)
      .limit(1)
      .get();
    if (!byPhone.empty) return { id: byPhone.docs[0].id, matchedBy: "phone" };
  }

  return null;
}

/**
 * Return the existing client for this person, or create one.
 *
 * When an existing record is found we only fill in blanks — never overwrite
 * details the therapist may have curated by hand.
 */
export async function findOrCreateClient(
  db: Firestore,
  identity: ClientIdentity,
  bookingId: string
): Promise<MatchResult> {
  const cleanEmail = identity.email.trim().toLowerCase();
  const cleanPhone = sanitizePhone(identity.whatsapp);
  const now = new Date().toISOString();

  const existing = await findExistingClient(db, cleanEmail, identity.whatsapp);

  if (existing) {
    const ref = db.collection("clients").doc(existing.id);
    const snap = await ref.get();
    const data = (snap.data() ?? {}) as Record<string, unknown>;

    // Backfill only what's missing, so nothing curated is clobbered.
    const patch: Record<string, string> = {};
    const fillIfBlank = (field: string, value?: string) => {
      if (value && !String(data[field] ?? "").trim()) patch[field] = value;
    };
    fillIfBlank("name", identity.name.trim());
    fillIfBlank("email", cleanEmail);
    fillIfBlank("whatsapp", cleanPhone);
    fillIfBlank("age", identity.age);
    fillIfBlank("gender", identity.gender);
    fillIfBlank("pronouns", identity.pronouns);

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = now;
      await ref.update(patch);
    }

    return { clientId: existing.id, created: false, matchedBy: existing.matchedBy };
  }

  const created = await db.collection("clients").add({
    name: identity.name.trim(),
    email: cleanEmail,
    whatsapp: cleanPhone,
    age: identity.age ?? "",
    gender: identity.gender ?? "",
    pronouns: identity.pronouns ?? "",
    occupation: "",
    desiredOutcomes: "",
    status: "active",
    bookingId,
    createdAt: now,
    updatedAt: now,
  });

  return { clientId: created.id, created: true, matchedBy: null };
}
