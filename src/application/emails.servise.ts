import type { AttachmentEntity } from "../domain/attachment.entity.ts";
import type { EmailsRepository } from "./interfaces/emails.repository.ts";
import { config } from "../config/env.ts";
import { EmailStatus } from "../domain/types.ts";
import type { EmailProvider } from "./interfaces/email-provider.ts";
import type { EmailEntity } from "../domain/email.entity.ts";

export interface SendEmailRequest {
  to: string[];
  subject: string;
  displayName?: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  html?: string;
  attachments?: Omit<AttachmentEntity, "id" | "createdAt" | "emailId">[];
}

export class EmailsService {
  private readonly emailsRepository: EmailsRepository;
  private readonly emailProvider: EmailProvider;

  constructor(
    emailsRepository: EmailsRepository,
    emailProvider: EmailProvider,
  ) {
    this.emailsRepository = emailsRepository;
    this.emailProvider = emailProvider;
  }

  async sendEmail(request: SendEmailRequest): Promise<EmailEntity> {
    const savedEmail = await this.emailsRepository.save({
      from: config.smtp.from,
      to: request.to,
      displayName: request.displayName || config.smtp.displayName,
      subject: request.subject,
      body: request.body,
      cc: request.cc,
      bcc: request.bcc,
      html: request.html,
      attachments: request.attachments,
      status: EmailStatus.PENDING,
    });

    try {
      // какая есть сейчас проблема, при проверке result.success если он true, то обновление статуса может упасть, но письмо отправлено
      // будут неконсистентные данные в базе
      const result = await this.emailProvider.send(savedEmail);

      if (result.success) {
        const sentEmail = this.emailsRepository.update({
          id: savedEmail.id,
          status: EmailStatus.SENT,
          sentAt: new Date(),
        });
        return sentEmail;
      } else {
        const failedEmail = this.emailsRepository.update({
          id: savedEmail.id,
          status: EmailStatus.FAILED,
          error: result.error || "Unknown error",
        });
        return failedEmail;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      const failedEmail = this.emailsRepository.update({
        id: savedEmail.id,
        status: EmailStatus.FAILED,
        error: errorMessage,
      });

      return failedEmail;
    }
  }

  async getEmailDetails(emailId: string): Promise<EmailEntity | null> {
    return this.emailsRepository.findById(emailId);
  }
  // TODO: getEmails() {}
}
