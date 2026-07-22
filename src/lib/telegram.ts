/**
 * Telegram alerts to the practice.
 *
 * These go to Nidhi, never to clients, so there is no consent flow here. They
 * deliberately carry only what the Privacy Policy already allows to leave the
 * practice for the Google Calendar entry — name, session type, date and time.
 * Nothing a client wrote about what brings them to therapy is ever sent.
 *
 * Entirely inert until TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set, the
 * same way the Google Calendar integration behaves. Every send is
 * fire-and-forget: an alert failing must never fail a booking.
 *
 * This file is duplicated in the website app. Keep the two in step.
 */

const API = "https://api.telegram.org";

export type AlertEvent =
  | "booking_created"
  | "booking_cancelled"
  | "booking_status"
  | "session_reminder";

const EVENT_LABELS: Record<AlertEvent, string> = {
  booking_created: "🗓️ New booking",
  booking_cancelled: "❌ Booking cancelled",
  booking_status: "🔄 Booking updated",
  session_reminder: "⏰ Session tomorrow",
};

export interface AlertPayload {
  event: AlertEvent;
  client: string;
  session: string;
  /** Already formatted for the practice's timezone, e.g. "Fri 24 Jul, 10:00 IST". */
  when: string;
  /** Optional trailing line — status change, who cancelled, meeting link. */
  note?: string;
  source?: "website" | "dashboard";
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** Telegram's HTML parse mode only needs these three escaped. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function chatIds(): string[] {
  return (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Post one message to every configured chat. Returns per-chat success. */
export async function sendTelegramMessage(
  html: string
): Promise<{ ok: boolean; errors: string[] }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ids = chatIds();
  if (!token || ids.length === 0) {
    return { ok: false, errors: ["Telegram is not configured"] };
  }

  const errors: string[] = [];
  await Promise.all(
    ids.map(async (chatId) => {
      try {
        const res = await fetch(`${API}/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: html,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            description?: string;
          };
          errors.push(`${chatId}: ${body.description ?? res.status}`);
        }
      } catch (error) {
        errors.push(`${chatId}: ${(error as Error).message}`);
      }
    })
  );

  return { ok: errors.length === 0, errors };
}

/** Format and send a booking alert. Never throws. */
export async function sendTelegramAlert(alert: AlertPayload): Promise<void> {
  if (!isTelegramConfigured()) return;

  const lines = [
    `<b>${EVENT_LABELS[alert.event]}</b>`,
    "",
    `<b>Client:</b> ${esc(alert.client || "—")}`,
    `<b>Session:</b> ${esc(alert.session || "—")}`,
    `<b>When:</b> ${esc(alert.when || "—")}`,
  ];
  if (alert.note) lines.push("", esc(alert.note));

  const { ok, errors } = await sendTelegramMessage(lines.join("\n"));
  if (!ok) console.error("telegram: alert failed", errors.join("; "));
}

/**
 * Chat IDs that have messaged the bot, for the one-time setup step in the
 * dashboard. A bot cannot message someone who has never written to it first,
 * so this is the only way to discover the ID without asking the user to read
 * raw JSON from an API URL.
 */
export async function discoverChatIds(): Promise<
  Array<{ id: string; name: string; type: string }>
> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return [];

  const res = await fetch(`${API}/bot${token}/getUpdates`);
  if (!res.ok) return [];

  const data = (await res.json()) as {
    result?: Array<{
      message?: {
        chat?: {
          id?: number;
          type?: string;
          title?: string;
          first_name?: string;
          username?: string;
        };
      };
    }>;
  };

  const found = new Map<string, { id: string; name: string; type: string }>();
  for (const update of data.result ?? []) {
    const chat = update.message?.chat;
    if (!chat?.id) continue;
    found.set(String(chat.id), {
      id: String(chat.id),
      name: chat.title ?? chat.first_name ?? chat.username ?? "Unknown",
      type: chat.type ?? "private",
    });
  }
  return [...found.values()];
}
