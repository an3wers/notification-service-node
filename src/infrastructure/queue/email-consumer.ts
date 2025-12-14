import type { EmailsService } from "../../application/emails.servise.ts";
import type { QueueService } from "../../application/interfaces/queue-service.ts";
import { config } from "../../config/env.ts";
import {
  normalizeSendEmailDto,
  SendEmailDtoSchema,
} from "../../contracts/send-email.dto.ts";

export class EmailConsumer {
  private readonly queueService: QueueService;
  private readonly emailService: EmailsService;

  constructor(queueService: QueueService, emailService: EmailsService) {
    this.queueService = queueService;
    this.emailService = emailService;
  }

  async start(): Promise<void> {
    await this.queueService.consume(config.rabbitmq.queue, async (message) => {
      console.log("Received email from queue:", message);

      try {
        const validatedData = SendEmailDtoSchema.parse(message);
        const normalized = normalizeSendEmailDto(validatedData);

        const result = await this.emailService.sendEmail(normalized);
        console.log(`Email sent successfully: ${result.id}`);
      } catch (error) {
        console.error("Failed to send email from queue:", error);
        throw error;
      }
    });

    console.log(`Listening for emails on queue: ${config.rabbitmq.queue}`);
  }
}
