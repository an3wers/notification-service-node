import type { EmailEntity } from "../../domain/email.entity.ts";

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  send(email: EmailEntity): Promise<SendEmailResult>;
}
