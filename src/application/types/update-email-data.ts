import type { EmailStatus } from "../../domain/types.ts";

export interface UpdateEmailData {
  id: string;
  status: EmailStatus;
  sentAt?: Date;
  error?: string;
}
