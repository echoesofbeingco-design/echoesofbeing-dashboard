import { NextRequest } from "next/server";
import { requireAuth, withSecurityHeaders } from "@/lib/auth";
import {
  discoverChatIds,
  isTelegramConfigured,
  sendTelegramMessage,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** Setup status + any chats that have messaged the bot. */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  const hasToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const chats = hasToken ? await discoverChatIds().catch(() => []) : [];

  return withSecurityHeaders(
    Response.json({
      hasToken,
      configured: isTelegramConfigured(),
      configuredChatIds: (process.env.TELEGRAM_CHAT_ID ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      // Chats that have written to the bot — a bot cannot message anyone who
      // hasn't contacted it first, so this is where the chat ID comes from.
      availableChats: chats,
    })
  );
}

/** Send a test alert to the configured chats. */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, "admin");
  if ("error" in auth) return auth.error;

  if (!isTelegramConfigured()) {
    return withSecurityHeaders(
      Response.json(
        { error: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID first." },
        { status: 400 }
      )
    );
  }

  const { ok, errors } = await sendTelegramMessage(
    [
      "<b>✅ Test alert</b>",
      "",
      "Telegram notifications are working.",
      `Sent from the dashboard by ${auth.payload.username}.`,
    ].join("\n")
  );

  return withSecurityHeaders(
    ok
      ? Response.json({ success: true })
      : Response.json({ error: errors.join("; ") }, { status: 502 })
  );
}
