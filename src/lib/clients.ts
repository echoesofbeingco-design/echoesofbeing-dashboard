import { getAdminDb } from "./firebase-admin";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  age: string;
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
  const snapshot = await db.collection("clients").get();
  const clients = snapshot.docs.map((doc) => doc.data());

  let active = 0;
  let inactive = 0;
  let discharged = 0;

  for (const c of clients) {
    if (c.status === "active") active++;
    else if (c.status === "inactive") inactive++;
    else if (c.status === "discharged") discharged++;
  }

  return { total: clients.length, active, inactive, discharged };
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
  const clientsSnap = await db.collection("clients").where("status", "==", "active").get();

  const tasks: Array<{
    clientId: string;
    clientName: string;
    sessionId: string;
    sessionDate: string;
    therapistHomework: string;
  }> = [];

  for (const clientDoc of clientsSnap.docs) {
    const clientData = clientDoc.data();
    // Get last session with therapist homework
    const sessionsSnap = await db
      .collection("clients")
      .doc(clientDoc.id)
      .collection("sessions")
      .orderBy("date", "desc")
      .limit(1)
      .get();

    for (const sessionDoc of sessionsSnap.docs) {
      const sessionData = sessionDoc.data();
      if (sessionData.therapistHomework && sessionData.therapistHomework.trim()) {
        tasks.push({
          clientId: clientDoc.id,
          clientName: clientData.name || "Unknown",
          sessionId: sessionDoc.id,
          sessionDate: normalizeTimestamp(sessionData.date) || sessionData.date || "",
          therapistHomework: sessionData.therapistHomework,
        });
      }
    }
  }

  return tasks;
}
