import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();

    // Validate required fields
    const { name, email, whatsapp, age, gender, pronouns, sessionType, category, concern } = body;

    const errors: string[] = [];
    if (!name?.trim()) errors.push("Name is required");
    if (!email?.trim()) errors.push("Email is required");
    if (!whatsapp?.trim()) errors.push("WhatsApp number is required");
    if (!age) errors.push("Age is required");
    if (!gender) errors.push("Gender is required");
    if (!pronouns) errors.push("Pronouns are required");
    if (!sessionType) errors.push("Session type is required");
    if (!category) errors.push("Category is required");
    if (!concern?.trim()) errors.push("Concern is required");

    if (errors.length > 0) {
      return withSecurityHeaders(
        Response.json({ error: errors.join(", ") }, { status: 400 })
      );
    }

    const db = getAdminDb();
    const now = new Date().toISOString();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Create booking
    const bookingData: Record<string, unknown> = {
      name: name.trim(),
      email: cleanEmail,
      whatsapp: whatsapp.trim(),
      age: String(age),
      gender,
      pronouns,
      sessionType,
      category,
      concern: concern.trim(),
      status: "intake_submitted",
      createdAt: now,
      updatedAt: now,
      source: "admin_dashboard",
    };

    if (body.aadhar) {
      bookingData.aadhar = body.aadhar;
    }

    const bookingDoc = await db.collection("bookings").add(bookingData);

    // 2. Create or link client record
    const existingClients = await db
      .collection("clients")
      .where("email", "==", cleanEmail)
      .limit(1)
      .get();

    let clientId: string;

    if (existingClients.empty) {
      // Create new client
      const clientDoc = await db.collection("clients").add({
        name: name.trim(),
        email: cleanEmail,
        whatsapp: whatsapp.trim(),
        age: String(age),
        gender,
        pronouns,
        occupation: "",
        desiredOutcomes: "",
        status: "active",
        bookingId: bookingDoc.id,
        createdAt: now,
        updatedAt: now,
      });
      clientId = clientDoc.id;
    } else {
      clientId = existingClients.docs[0].id;
    }

    // Link client to booking
    await db.collection("bookings").doc(bookingDoc.id).update({ clientId });

    return withSecurityHeaders(
      Response.json(
        { id: bookingDoc.id, clientId, message: "Booking created successfully" },
        { status: 201 }
      )
    );
  } catch (error) {
    console.error("Error creating booking:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to create booking" }, { status: 500 })
    );
  }
}
