// Shared string constants (SQLite has no enums — validate against these).

export const ROLES = {
  ADMIN: "ADMIN",
  WORKER: "WORKER",
  CLIENT: "CLIENT",
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

export const INVOICE_STATUS = {
  OPEN: "OPEN",
  PAID: "PAID",
  FAILED: "FAILED",
  VOID: "VOID",
} as const;

export const CHANGE_REQUEST_TYPE = {
  DATE_CHANGE: "DATE_CHANGE",
  SHIFT_SWAP: "SHIFT_SWAP",
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
  INVOICE_ISSUED: "INVOICE_ISSUED", // final invoice sent the evening before payment
  PAYMENT_SUCCEEDED: "PAYMENT_SUCCEEDED", // card charged successfully
  PAYMENT_FAILED: "PAYMENT_FAILED",
  CARD_EXPIRING: "CARD_EXPIRING",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ADD_CARD: "ADD_CARD",
  CONTACT_MESSAGE: "CONTACT_MESSAGE",
} as const;

// A user can be assigned walks if they are an admin or an active worker.
export function canWork(role: string) {
  return role === ROLES.ADMIN || role === ROLES.WORKER;
}
