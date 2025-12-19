// Выполняет мягкое удаление emails старше 30 дней
// Выполняет полное удаление emails старше 180 дней
// Примечание: при мягком удалении, если у письма были связанные файла, то файлы удаляются из хранилища (папка uploads)

import type { EmailsService } from "../../application/emails.service.ts";
import type { EmailsRepository } from "../../application/interfaces/emails-repository.ts";

export class EmailCleanupJob {
  private readonly emailsRepository: EmailsRepository;
  private readonly emailService: EmailsService;

  constructor(emailsRepository: EmailsRepository, emailService: EmailsService) {
    this.emailsRepository = emailsRepository;
    this.emailService = emailService;
  }

  // soft delete emails older than 30 days
  async softDeleteEmails(): Promise<void> {
    try {
      const emailIds = await this.emailsRepository.getEmailsIdOlderThan(30);
      if (emailIds.length === 0) {
        return;
      }

      const deletePromises = emailIds.map((emailId) =>
        this.emailService.deleteEmailSoft(emailId),
      );

      const results = await Promise.allSettled(deletePromises);

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            `Failed to delete email ${emailIds[index]}:`,
            result.reason,
          );
        }
      });
    } catch (error) {
      console.error("Failed to soft delete emails:", error);
      throw error;
    }
  }

  // hard delete emails older than 180 days
  async hardDeleteEmails(): Promise<void> {
    try {
      const emailIds = await this.emailsRepository.getEmailsIdOlderThan(180);
      if (emailIds.length === 0) {
        return;
      }

      const deletePromises = emailIds.map((emailId) =>
        this.emailService.deleteEmailHard(emailId),
      );

      const results = await Promise.allSettled(deletePromises);

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            `Failed to delete email ${emailIds[index]}:`,
            result.reason,
          );
        }
      });
    } catch (error) {
      console.error("Failed to hard delete emails:", error);
      throw error;
    }
  }
}
