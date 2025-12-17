import nodemailer, { type Transporter } from "nodemailer";
import type { EmailEntity } from "../domain/email.entity.ts";
import type {
  EmailProvider,
  SendEmailResult,
} from "../application/interfaces/email-provider.ts";
import { config } from "../config/env.ts";

export class NodemailerProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    const options: Record<string, unknown> = {
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.auth.user,
        pass: config.smtp.auth.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: config.smtp.connectionTimeout,
      greetingTimeout: config.smtp.greetingTimeout,
      socketTimeout: config.smtp.socketTimeout,
      dnsTimeout: config.smtp.dnsTimeout,
    };

    this.transporter = nodemailer.createTransport(options);
  }

  async send(email: EmailEntity): Promise<SendEmailResult> {
    try {
      const mailOptions = {
        from: `${email.displayName} <${email.from}>`,
        to: email.to.join(", "),
        cc: email.cc?.join(", "),
        bcc: email.bcc?.join(", "),
        subject: email.subject,
        text: email.body,
        html: email.html || undefined,
        attachments: email.attachments?.map((att) => ({
          filename: att.originalName,
          path: att.path,
        })),
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
