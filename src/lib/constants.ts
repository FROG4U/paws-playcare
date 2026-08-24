// Shared string constants (SQLite has no enums — validate against these).

export const ROLES = {
  ADMIN: "ADMIN",
  WORKER: "WORKER",
  CLIENT: "CLIENT",
  // Field/playground-hire customer. A separate product from dog walking, so it
  // gets its own dashboard (/field-account) while sharing the header login.
  FIELD_CLIENT: "FIELD_CLIENT",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const PAY_CADENCE = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
} as const;
export type PayCadence = (typeof PAY_CADENCE)[keyof typeof PAY_CADENCE];

export const BOOKING_TYPE = {
  ONE_OFF: "ONE_OFF",
  RECURRING: "RECURRING",
} as const;

export const BOOKING_STATUS = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",   // admin paused this booking — future walks cancelled, resumable
  ENDED: "ENDED",
  CANCELLED: "CANCELLED",
} as const;

export const TIME_SLOTS = ["AM", "LUNCH", "PM"] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

// Weekly booking-requirement slots, mirroring the pawsplaycare.co.uk form
// (AM + lunch time Mon–Thu, Friday AM only).
export const BOOKING_SLOTS = [
  { key: "MON_AM", label: "Monday AM" },
  { key: "MON_LUNCH", label: "Monday lunch time" },
  { key: "TUE_AM", label: "Tuesday AM" },
  { key: "TUE_LUNCH", label: "Tuesday lunch time" },
  { key: "WED_AM", label: "Wednesday AM" },
  { key: "WED_LUNCH", label: "Wednesday lunch time" },
  { key: "THU_AM", label: "Thursday AM" },
  { key: "THU_LUNCH", label: "Thursday lunch time" },
  { key: "FRI_AM", label: "Friday AM" },
] as const;

export const BOOKING_SLOT_LABELS: Record<string, string> = Object.fromEntries(
  BOOKING_SLOTS.map((s) => [s.key, s.label])
);

// Walk lifecycle
export const WALK_STATUS = {
  REQUESTED: "REQUESTED", // booked by client, no worker yet
  ASSIGNED: "ASSIGNED", // admin allocated a worker, awaiting worker accept
  ACCEPTED: "ACCEPTED", // worker accepted -> "Walk accepted"
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  DECLINED: "DECLINED", // worker declined; back to admin
} as const;
export type WalkStatus = (typeof WALK_STATUS)[keyof typeof WALK_STATUS];

export const WALK_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Awaiting assignment",
  ASSIGNED: "Awaiting worker",
  ACCEPTED: "Walk accepted",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DECLINED: "Declined",
};

// What to show on a walk's badge. There's no team — every walk is the admin's —
// so the two worker-assignment steps have nothing to say and are left blank.
// Only a real state (completed, cancelled, declined) gets a badge.
export function walkStatusBadge(status: string): string | null {
  if (status === WALK_STATUS.REQUESTED || status === WALK_STATUS.ASSIGNED) return null;
  return WALK_STATUS_LABELS[status] ?? status;
}

// A walk cancellation with fewer than this many days' notice is chargeable.
export const CANCEL_NOTICE_DAYS = 7;

export const INVOICE_STATUS = {
  OPEN: "OPEN",
  PAID: "PAID",
  FAILED: "FAILED",
  VOID: "VOID",
} as const;

export const CHANGE_REQUEST_TYPE = {
  DATE_CHANGE: "DATE_CHANGE",
  SHIFT_SWAP: "SHIFT_SWAP",
  CANCELLATION: "CANCELLATION", // client asks to cancel an upcoming walk
} as const;

export const CHANGE_REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export const NOTIF_TYPE = {
  ACCOUNT_PENDING: "ACCOUNT_PENDING",
  ACCOUNT_APPROVED: "ACCOUNT_APPROVED",
  BOOKING_CREATED: "BOOKING_CREATED", // client made a new booking (notify admins)
  BOOKING_ACCEPTED: "BOOKING_ACCEPTED", // admin accepted the request (notify client)
  BOOKING_REJECTED: "BOOKING_REJECTED", // admin rejected the request (notify client)
  BOOKING_UPDATED: "BOOKING_UPDATED", // admin changed the booking dates (notify client)
  WALK_ASSIGNED: "WALK_ASSIGNED",
  WALK_ACCEPTED: "WALK_ACCEPTED",
  WALK_COMPLETED: "WALK_COMPLETED",
  WALK_SKIPPED: "WALK_SKIPPED", // a recurring date fell on a bank holiday and was skipped
  CHANGE_REQUESTED: "CHANGE_REQUESTED",
  CHANGE_RESOLVED: "CHANGE_RESOLVED",
  CANCELLATION_REQUESTED: "CANCELLATION_REQUESTED", // client asked to cancel a walk (notify admins)
  CANCELLATION_RESOLVED: "CANCELLATION_RESOLVED",   // admin approved/declined the cancellation (notify client)
  INVOICE_ISSUED: "INVOICE_ISSUED", // final invoice sent the evening before payment
  PAYMENT_SUCCEEDED: "PAYMENT_SUCCEEDED", // card charged successfully
  PAYMENT_FAILED: "PAYMENT_FAILED",
  CARD_EXPIRING: "CARD_EXPIRING",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ADD_CARD: "ADD_CARD",
  CONTACT_MESSAGE: "CONTACT_MESSAGE",
  FIELD_BOOKING_PAID: "FIELD_BOOKING_PAID", // a field/playground booking was paid (notify admins)
  PAUSE_REQUESTED: "PAUSE_REQUESTED", // client asked an admin to pause their walks
  PAUSE_RESOLVED: "PAUSE_RESOLVED",   // admin paused/declined (notify client)
  COMPLETE_REMINDER: "COMPLETE_REMINDER", // evening nudge: walks waiting to be completed
} as const;

// ---------------------------------------------------------------------------
// Field / playground hire (separate product from dog walking)
// ---------------------------------------------------------------------------
export const FIELD_BOOKING_STATUS = {
  PENDING: "PENDING", // slots reserved, awaiting payment
  PAID: "PAID",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
} as const;

// A field slot row either represents a paid/pending customer booking or an
// admin block-out. The @@unique([date,hour]) constraint means an hour can only
// ever hold one of these — which is exactly how we stop double-booking.
export const FIELD_SLOT_KIND = {
  BOOKING: "BOOKING",
  BLOCK: "BLOCK",
} as const;

export const FIELD_COUPON_TYPE = {
  PERCENT: "PERCENT",
  FIXED: "FIXED",
} as const;

// How the summer/winter opening hours are decided.
export const FIELD_SEASON_MODE = {
  AUTO: "AUTO", // British Summer Time = summer hours, GMT = winter hours
  ALWAYS_SUMMER: "ALWAYS_SUMMER",
  ALWAYS_WINTER: "ALWAYS_WINTER",
} as const;

// A user can be assigned walks if they are an admin or an active worker.
export function canWork(role: string) {
  return role === ROLES.ADMIN || role === ROLES.WORKER;
}
