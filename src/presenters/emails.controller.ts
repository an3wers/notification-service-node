import type { Request, Response, NextFunction } from "express";
import type { EmailsService } from "../application/emails.service.ts";
import { SendEmailDtoSchema } from "../contracts/send-email.dto.ts";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../presenters/errors/app-error.ts";
import { config } from "../config/env.ts";
import { normalizeSendEmailDto } from "../contracts/normalize-dto.ts";

export class EmailsController {
  private readonly emailService: EmailsService;

  constructor(emailService: EmailsService) {
    this.emailService = emailService;
  }

  async sendEmail(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // TODO: move to middleware
      if (!req.headers["ssy"] || req.headers["ssy"] !== config.secretKey) {
        throw new ValidationError(`Invalid secret key`);
      }

      const validatedData = SendEmailDtoSchema.parse(req.body);
      const normalized = normalizeSendEmailDto(validatedData);

      if (req.files && !Array.isArray(req.files)) {
        throw new ValidationError("Invalid file format");
      }

      const files = req.files as Express.Multer.File[] | undefined;

      const attachments =
        files?.map((file) => ({
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          url: null,
        })) || [];

      if (attachments.length > 30) {
        throw new ValidationError("Maximum 30 attachments allowed");
      }

      const result = await this.emailService.sendEmail({
        ...normalized,
        attachments,
      });

      if (result.status === "FAILED") {
        throw new BadRequestError(result.error || "Failed to send email");
      }

      res.status(201).json({
        data: {
          id: result.id,
        },
        success: true,
        message: "Email sent successfully",
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEmailDetails(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const email = await this.emailService.getEmailDetails(id);

      if (!email) {
        throw new NotFoundError("Email not found");
      }

      res.json({
        data: {
          id: email.id,
          from: email.from,
          status: email.status,
          to: email.to,
          displayName: email.displayName,
          subject: email.subject,
          attachments: email.attachments,
          error: email.error,
          sentAt: email.sentAt,
          createdAt: email.createdAt,
          updatedAt: email.updatedAt,
          deletedAt: email.deletedAt,
        },
        success: true,
        message: "Email found successfully",
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Type Guard for attachments
function isFileArray(files: unknown): files is Express.Multer.File[] {
  return (
    Array.isArray(files) && files.every((file) => typeof file === "object")
  );
}
