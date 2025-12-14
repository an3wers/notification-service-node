// export enum EmailStatus {
//   PENDING = "pending",
//   SENT = "sent",
//   FAILED = "failed",
//   QUEUED = "queued",
// }

export const EmailStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  QUEUED: "QUEUED",
} as const;

export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus];
