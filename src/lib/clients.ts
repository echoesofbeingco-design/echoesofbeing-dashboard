import { getAdminDb } from "./firebase-admin";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  age: string;
  dateOfBirth?: string;
  gender: string;
  pronouns: string;
  occupation: string;
  desiredOutcomes: string;
  status: "active" | "inactive" | "discharged";
  bookingId?: string;
  // Clinical fields (client-level, not per-session)
  symptoms: string;
  concerns: string;
  stressors: string;
  interpersonalHistory: InterpersonalHistory;
  keyThemes: KeyThemes;
  theoreticalLens: TheoreticalLens;
  treatmentFocus: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterpersonalHistory {
  strengths: string;
  challenges: string;
  significantChanges: string;
  romanticPatterns: string;
  familyPatterns: string;
  friendsPatterns: string;
  workplacePatterns: string;
}

export interface KeyThemes {
  thoughts: string;
  emotions: string;
  behaviors: string;
  environmental: string;
}

export interface TheoreticalLens {
  origin: string;
  maintainingProcesses: string;
  focusOfIntervention: string;
}

export interface ClientSession {
  id: string;
  clientId: string;
  date: string;
  sessionNumber: number;
  summary: string;
  presentingProblem: string;
  nextSession: string;
  clientHomework: string;
  therapistHomework: string;
  createdAt: string;
  updatedAt: string;
}

// ── Timestamp helper ──────────────────────────────────────────────────────

function normalizeTimestamp(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  if (
    typeof val === "object" &&
    val !== null &&
    "toDate" in val &&
    typeof (val as Record<string, unknown>).toDate === "function"
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === "object" && val !== null && "_seconds" in val) {
    const secs = (val as { _seconds: number })._seconds;
    return new Date(secs * 1000).toISOString();
  }
  return undefined;
}

// ── Clients ────────────────────────────────────────────────────────────────

export async function getAllClients(): Promise<Client[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("clients").orderBy("createdAt", "desc").get();

  return snapshot.docs.map((doc) => normalizeClient(doc));
}

/**
 * Lightweight query for list views — fetches only the fields needed for the
 * clients table, skipping heavy clinical data (saves bandwidth & latency).
 */
export async function getAllClientsLite(): Promise<
  Array<{
    id: string; name: string; email: string; whatsapp: string;
    age: string; gender: string; pronouns: string; occupation: string;
    status: string; createdAt: string;
  }>
> {
  const db = getAdminDb();
  const snapshot = await db
    .collection("clients")
    .orderBy("createdAt", "desc")
    .select("name", "email", "whatsapp", "age", "gender", "pronouns", "occupation", "status", "createdAt")
    .get();

  return snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name || "",
      email: d.email || "",
      whatsapp: d.whatsapp || "",
      age: d.age || "",
      gender: d.gender || "",
      pronouns: d.pronouns || "",
      occupation: d.occupation || "",
      status: d.status || "active",
      createdAt: normalizeTimestamp(d.createdAt) || "",
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeClient(doc: any): Client {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || "",
    email: data.email || "",
    whatsapp: data.whatsapp || "",
    age: data.age || "",
    gender: data.gender || "",
    pronouns: data.pronouns || "",
    occupation: data.occupation || "",
    desiredOutcomes: data.desiredOutcomes || "",
    status: data.status || "active",
    bookingId: data.bookingId || undefined,
    symptoms: data.symptoms || "",
    concerns: data.concerns || "",
    stressors: data.stressors || "",
    interpersonalHistory: {
      ...EMPTY_INTERPERSONAL,
      ...(data.interpersonalHistory || {}),
    },
    keyThemes: {
      ...EMPTY_KEY_THEMES,
      ...(data.keyThemes || {}),
    },
    theoreticalLens: {
      ...EMPTY_THEORETICAL_LENS,
      ...(data.theoreticalLens || {}),
    },
    treatmentFocus: data.treatmentFocus || "",
    createdAt: normalizeTimestamp(data.createdAt) || "",
    updatedAt: normalizeTimestamp(data.updatedAt) || "",
  };
}

export async function getClientById(id: string): Promise<Client | null> {
  const db = getAdminDb();
  const doc = await db.collection("clients").doc(id).get();
  if (!doc.exists) return null;
  return normalizeClient(doc);
}

export async function createClient(data: {
  name: string;
  email: string;
  whatsapp: string;
  age: string;
  gender: string;
  pronouns: string;
  occupation: string;
  desiredOutcomes: string;
  bookingId?: string;
}): Promise<string> {
  const db = getAdminDb();
  const now = new Date().toISOString();
  const doc = await db.collection("clients").add({
    ...data,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  return doc.id;
}

export async function updateClient(
  id: string,
  updates: Partial<Omit<Client, "id" | "createdAt">>
): Promise<void> {
  const db = getAdminDb();
  await db
    .collection("clients")
    .doc(id)
    .update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
}

/**
 * Permanently delete a client and everything beneath them.
 *
 * Firestore does NOT cascade — deleting the client document would leave the
 * `sessions` subcollection orphaned: invisible in the UI, but still returned
 * by the `collectionGroup("sessions")` query the dashboard home page runs, and
 * still billed as storage. So the subcollection is drained explicitly first.
 *
 * Any bookings that referenced this client are unlinked rather than deleted —
 * the booking is its own record of an appointment that genuinely happened, and
 * silently destroying appointment history from a client-delete would be a
 * surprise. Delete those from the Bookings page if you want them gone.
 *
 * Returns what was removed so the caller can report it honestly.
 */
export async function deleteClient(
  id: string
): Promise<{ deleted: boolean; sessionsDeleted: number; bookingsUnlinked: number }> {
  const db = getAdminDb();
  const clientRef = db.collection("clients").doc(id);
  const snap = await clientRef.get();
  if (!snap.exists) {
    return { deleted: false, sessionsDeleted: 0, bookingsUnlinked: 0 };
  }

  // 1. Drain the sessions subcollection in batches (500 = Firestore's limit).
  let sessionsDeleted = 0;
  for (;;) {
    const batchSnap = await clientRef.collection("sessions").limit(400).get();
    if (batchSnap.empty) break;
    const batch = db.batch();
    batchSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    sessionsDeleted += batchSnap.size;
    if (batchSnap.size < 400) break;
  }

  // 2. Unlink bookings that point at this client.
  const linked = await db
    .collection("bookings")
    .where("clientId", "==", id)
    .select()
    .get();
  let bookingsUnlinked = 0;
  if (!linked.empty) {
    const batch = db.batch();
    linked.docs.forEach((d) => batch.update(d.ref, { clientId: null }));
    await batch.commit();
    bookingsUnlinked = linked.size;
  }

  // 3. Finally the client itself.
  await clientRef.delete();

  return { deleted: true, sessionsDeleted, bookingsUnlinked };
}

/** Session count for a client — used to warn before deleting. */
export async function countClientSessions(id: string): Promise<number> {
  const db = getAdminDb();
  const agg = await db
    .collection("clients")
    .doc(id)
    .collection("sessions")
    .count()
    .get();
  return agg.data().count;
}

// ── Sessions ──────────────────────────────────────────────────────────────

const EMPTY_INTERPERSONAL: InterpersonalHistory = {
  strengths: "",
  challenges: "",
  significantChanges: "",
  romanticPatterns: "",
  familyPatterns: "",
  friendsPatterns: "",
  workplacePatterns: "",
};

const EMPTY_KEY_THEMES: KeyThemes = {
  thoughts: "",
  emotions: "",
  behaviors: "",
  environmental: "",
};

const EMPTY_THEORETICAL_LENS: TheoreticalLens = {
  origin: "",
  maintainingProcesses: "",
  focusOfIntervention: "",
};

function normalizeSession(
  docId: string,
  clientId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
): ClientSession {
  return {
    id: docId,
    clientId,
    date: normalizeTimestamp(data.date) || data.date || "",
    sessionNumber: data.sessionNumber || 0,
    summary: data.summary || "",
    presentingProblem: data.presentingProblem || "",
    nextSession: data.nextSession || "",
    clientHomework: data.clientHomework || "",
    therapistHomework: data.therapistHomework || "",
    createdAt: normalizeTimestamp(data.createdAt) || "",
    updatedAt: normalizeTimestamp(data.updatedAt) || "",
  };
}

export async function getClientSessions(
  clientId: string
): Promise<ClientSession[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection("clients")
    .doc(clientId)
    .collection("sessions")
    .orderBy("date", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    normalizeSession(doc.id, clientId, doc.data())
  );
}

export async function getSessionById(
  clientId: string,
  sessionId: string
): Promise<ClientSession | null> {
  const db = getAdminDb();
  const doc = await db
    .collection("clients")
    .doc(clientId)
    .collection("sessions")
    .doc(sessionId)
    .get();

  if (!doc.exists) return null;
  return normalizeSession(doc.id, clientId, doc.data()!);
}

export async function createSession(
  clientId: string,
  data: {
    date: string;
    sessionNumber: number;
    summary?: string;
    presentingProblem?: string;
  }
): Promise<string> {
  const db = getAdminDb();
  const now = new Date().toISOString();
  const doc = await db
    .collection("clients")
    .doc(clientId)
    .collection("sessions")
    .add({
      date: data.date,
      sessionNumber: data.sessionNumber,
      summary: data.summary || "",
      presentingProblem: data.presentingProblem || "",
      nextSession: "",
      clientHomework: "",
      therapistHomework: "",
      createdAt: now,
      updatedAt: now,
    });
  return doc.id;
}

export async function updateSession(
  clientId: string,
  sessionId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updates: Record<string, any>
): Promise<void> {
  const db = getAdminDb();
  await db
    .collection("clients")
    .doc(clientId)
    .collection("sessions")
    .doc(sessionId)
    .update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
}

export async function deleteSession(
  clientId: string,
  sessionId: string
): Promise<void> {
  const db = getAdminDb();
  await db
    .collection("clients")
    .doc(clientId)
    .collection("sessions")
    .doc(sessionId)
    .delete();
}

// ── Sync bookings → clients (one-time migration for existing bookings) ───

export async function syncBookingsToClients(): Promise<number> {
  const db = getAdminDb();

  // Find bookings that don't have a clientId
  const bookingsSnap = await db.collection("bookings").get();
  let synced = 0;

  for (const bookingDoc of bookingsSnap.docs) {
    const data = bookingDoc.data();

    // Skip if already linked to a client
    if (data.clientId) continue;

    // Skip if missing essential info
    if (!data.email || !data.name) continue;

    const cleanEmail = (data.email as string).trim().toLowerCase();

    // Check if a client with this email already exists
    const existingClients = await db
      .collection("clients")
      .where("email", "==", cleanEmail)
      .limit(1)
      .get();

    let clientId: string;

    if (existingClients.empty) {
      // Create client from booking data
      const now = new Date().toISOString();
      const clientDoc = await db.collection("clients").add({
        name: data.name || "",
        email: cleanEmail,
        whatsapp: data.whatsapp || "",
        age: data.age || "",
        gender: data.gender || "",
        pronouns: data.pronouns || "",
        occupation: "",
        desiredOutcomes: "",
        status: "active",
        bookingId: bookingDoc.id,
        createdAt: data.createdAt || now,
        updatedAt: now,
      });
      clientId = clientDoc.id;
    } else {
      clientId = existingClients.docs[0].id;
    }

    // Link booking to client
    await db
      .collection("bookings")
      .doc(bookingDoc.id)
      .update({ clientId });

    synced++;
  }

  return synced;
}

// ── Stats ─────────────────────────────────────────────────────────────────

export async function getClientStats() {
  const db = getAdminDb();

  // Run three targeted count queries in parallel instead of fetching ALL documents
  const [activeSnap, inactiveSnap, dischargedSnap] = await Promise.all([
    db.collection("clients").where("status", "==", "active").count().get(),
    db.collection("clients").where("status", "==", "inactive").count().get(),
    db.collection("clients").where("status", "==", "discharged").count().get(),
  ]);

  const active = activeSnap.data().count;
  const inactive = inactiveSnap.data().count;
  const discharged = dischargedSnap.data().count;

  return { total: active + inactive + discharged, active, inactive, discharged };
}

// ── Therapist homework (pending tasks across all clients) ────────────────

export async function getPendingTherapistHomework(): Promise<
  Array<{
    clientId: string;
    clientName: string;
    sessionId: string;
    sessionDate: string;
    therapistHomework: string;
  }>
> {
  const db = getAdminDb();

  // Two parallel queries instead of N+1 sequential queries:
  // 1. All active clients (for names)
  // 2. One collection-group query for ALL sessions. We intentionally do NOT
  //    orderBy here — ordering a collection-group query requires a special
  //    collection-group index. Instead we pick the latest session per client
  //    in memory below, which keeps this a single, index-free query.
  const [clientsSnap, sessionsSnap] = await Promise.all([
    db.collection("clients").where("status", "==", "active").select("name").get(),
    // Projection matters here: without it this pulls every field of every
    // session ever recorded — including the full clinical notes — on each
    // dashboard load. We only need these two fields.
    db.collectionGroup("sessions").select("therapistHomework", "date").get(),
  ]);

  // Build a lookup map: clientId → name
  const clientNames = new Map<string, string>();
  for (const doc of clientsSnap.docs) {
    clientNames.set(doc.id, doc.data().name || "Unknown");
  }

  // For each active client, keep only their most recent session.
  const latestByClient = new Map<string, {
    dateMs: number;
    sessionId: string;
    sessionDate: string;
    therapistHomework: string;
  }>();

  for (const sessionDoc of sessionsSnap.docs) {
    // Path: clients/{clientId}/sessions/{sessionId}
    const clientId = sessionDoc.ref.path.split("/")[1];
    if (!clientNames.has(clientId)) continue; // only active clients

    const data = sessionDoc.data();
    const sessionDate =
      normalizeTimestamp(data.date) || (data.date as string) || "";
    const dateMs = sessionDate ? new Date(sessionDate).getTime() : 0;

    const existing = latestByClient.get(clientId);
    if (!existing || dateMs > existing.dateMs) {
      latestByClient.set(clientId, {
        dateMs,
        sessionId: sessionDoc.id,
        sessionDate,
        therapistHomework: (data.therapistHomework as string) || "",
      });
    }
  }

  const tasks: Array<{
    clientId: string;
    clientName: string;
    sessionId: string;
    sessionDate: string;
    therapistHomework: string;
  }> = [];

  for (const [clientId, session] of latestByClient) {
    if (session.therapistHomework && session.therapistHomework.trim()) {
      tasks.push({
        clientId,
        clientName: clientNames.get(clientId) || "Unknown",
        sessionId: session.sessionId,
        sessionDate: session.sessionDate,
        therapistHomework: session.therapistHomework,
      });
    }
  }

  return tasks;
}
