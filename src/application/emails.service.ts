import type { AttachmentEntity } from "../domain/attachment.entity.ts";
import type { EmailsRepository } from "./interfaces/emails-repository.ts";
import { config } from "../config/env.ts";
import { EmailStatus } from "../domain/types.ts";
import type { EmailProvider } from "./interfaces/email-provider.ts";
import type { EmailEntity } from "../domain/email.entity.ts";
import { StorageService } from "./storage.service.ts";

export interface SendEmailRequest {
  to: string[];
  subject: string;
  from?: string;
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
  private readonly storageService: StorageService;

  constructor(
    emailsRepository: EmailsRepository,
    emailProvider: EmailProvider,
  ) {
    this.emailsRepository = emailsRepository;
    this.emailProvider = emailProvider;
    this.storageService = new StorageService(); // no DI because it's a simple service
  }

  async sendEmail(request: SendEmailRequest): Promise<EmailEntity | null> {
    const savedEmail = await this.emailsRepository.save({
      from: request.from || config.smtp.from,
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

        if (!sentEmail) {
          throw new Error("Failed to update email status");
        }

        return sentEmail;
      } else {
        const failedEmail = this.emailsRepository.update({
          id: savedEmail.id,
          status: EmailStatus.FAILED,
          error: result.error || "Unknown error",
        });

        if (!failedEmail) {
          throw new Error("Failed to update email status");
        }

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

      if (!failedEmail) {
        throw new Error("Failed to update email status");
      }

      return failedEmail;
    }
  }

  async getEmailDetails(emailId: string): Promise<EmailEntity | null> {
    return this.emailsRepository.findById(emailId);
  }
  // TODO: getEmails

  async deleteEmailSoft(emailId: string): Promise<EmailEntity | null> {
    try {
      const deletedEmail = await this.emailsRepository.deleteSoft(emailId);

      if (!deletedEmail) {
        return null;
      }

      if (deletedEmail && deletedEmail.attachments.length > 0) {
        const deletePromises = deletedEmail.attachments.map((attachment) =>
          this.storageService.deleteAttachment(attachment),
        );

        const results = await Promise.allSettled(deletePromises);

        results.forEach((result, index) => {
          if (result.status === "rejected") {
            console.error(
              `Failed to delete attachment ${deletedEmail.attachments[index].filename}:`,
              result.reason,
            );
          }
        });
      }

      return deletedEmail;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error(errorMessage);

      throw new Error(errorMessage);
    }
  }

  async deleteEmailHard(emailId: string): Promise<void> {
    try {
      await this.emailsRepository.deleteHard(emailId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
}
