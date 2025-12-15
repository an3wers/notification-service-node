import type { AttachmentEntity } from "./attachment.entity.ts";
import type { EmailStatus } from "./types.ts";

export interface EmailEntity {
  id: string;
  from: string;
  displayName: string;
  to: string[];
  subject: string;
  body: string;
  status: EmailStatus;
  cc: string[];
  bcc: string[];
  html: string | null;
  attachments: AttachmentEntity[];
  error: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
