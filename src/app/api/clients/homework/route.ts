import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import { getPendingTherapistHomework } from "@/lib/clients";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const tasks = await getPendingTherapistHomework();
    return withSecurityHeaders(Response.json({ tasks }));
  } catch (error) {
    console.error("Error fetching therapist homework:", error);
    return withSecurityHeaders(
      Response.json(
        { error: "Failed to fetch therapist homework" },
        { status: 500 }
      )
    );
  }
}
