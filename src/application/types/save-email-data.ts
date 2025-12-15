import type { AttachmentEntity } from "../../domain/attachment.entity.ts";
import type { EmailStatus } from "../../domain/types.ts";

export interface SaveEmailData {
  from: string;
  to: string[];
  displayName: string;
  subject: string;
  body: string;
  status: EmailStatus;
  cc?: string[];
  bcc?: string[];
  html?: string;
  attachments?: Omit<AttachmentEntity, "id" | "createdAt" | "emailId">[];
}
