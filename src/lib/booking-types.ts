export interface Booking {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  age: string;
  gender: string;
  pronouns: string;
  sessionType: string;
  category: string;
  concern: string;
  status: string;
  clientId?: string;
  createdAt: string;
  calendly?: {
    eventName?: string;
    eventDate?: string;
    eventTime?: string;
    inviteeUri?: string;
    eventUri?: string;
  };
  consent?: {
    paidSession?: boolean;
    paymentFirst?: boolean;
    communicationConsent?: boolean;
    notes?: string;
  };
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  source?: string;
  updatedAt?: string;
}

export type BookingStatus =
  | "intake_submitted"
  | "slot_reserved"
  | "pending_payment"
  | "payment_received"
  | "session_completed"
  | "cancelled"
  | "no_show";

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  intake_submitted: { label: "Intake Submitted", color: "bg-blue-100 text-blue-800" },
  slot_reserved: { label: "Slot Reserved", color: "bg-amber-100 text-amber-800" },
  pending_payment: { label: "Pending Payment", color: "bg-orange-100 text-orange-800" },
  payment_received: { label: "Payment Received", color: "bg-emerald-100 text-emerald-800" },
  session_completed: { label: "Session Completed", color: "bg-sage-300 text-forest" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
  no_show: { label: "No Show", color: "bg-gray-100 text-gray-800" },
};
