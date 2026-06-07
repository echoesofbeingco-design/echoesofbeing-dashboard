import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getAllClients, createClient, syncBookingsToClients } from "@/lib/clients";

export const dynamic = "force-dynamic";

// Track if we've already synced in this process lifecycle
let hasSynced = false;

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    // Auto-sync existing bookings → clients on first load
    if (!hasSynced) {
      const synced = await syncBookingsToClients();
      if (synced > 0) {
        console.log(`Auto-synced ${synced} booking(s) → client records`);
      }
      hasSynced = true;
    }

    const clients = await getAllClients();
    return withSecurityHeaders(Response.json({ clients }));
  } catch (error) {
    console.error("Error fetching clients:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to fetch clients" }, { status: 500 })
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();

    // Validate required fields
    const { name, email, whatsapp } = body;
    if (!name?.trim() || !email?.trim() || !whatsapp?.trim()) {
      return withSecurityHeaders(
        Response.json(
          { error: "Name, email, and WhatsApp are required" },
          { status: 400 }
        )
      );
    }

    const id = await createClient({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      whatsapp: whatsapp.trim(),
      age: body.age || "",
      gender: body.gender || "",
      pronouns: body.pronouns || "",
      occupation: body.occupation || "",
      desiredOutcomes: body.desiredOutcomes || "",
      bookingId: body.bookingId || undefined,
    });

    return withSecurityHeaders(
      Response.json({ id, message: "Client created successfully" }, { status: 201 })
    );
  } catch (error) {
    console.error("Error creating client:", error);
    return withSecurityHeaders(
      Response.json({ error: "Failed to create client" }, { status: 500 })
    );
  }
}
