import { BaseRepository, type PoolClient } from "@shared/db-lib";
import type { EmailsRepository } from "../application/interfaces/emails.repository.ts";
import type { SaveEmailData } from "../application/types/save-email-data.ts";
import { EmailEntity } from "../domain/email.entity.ts";
import type { UpdateEmailData } from "../application/types/update-email-data.ts";
import { AttachmentEntity } from "../domain/attachment.entity.ts";
import { EmailStatus } from "../domain/types.ts";

interface EmailRow {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  html: string | null;
  status: string;
  error: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailsSqlRepository
  extends BaseRepository
  implements EmailsRepository
{
  async save(data: SaveEmailData): Promise<EmailEntity> {
    return await this.transaction(async (client: PoolClient) => {
      // Вставляем письмо
      const emailResult = await client.query<EmailRow>(
        `INSERT INTO "emails" (
                    "from", "to", cc, bcc, subject, body, html, status, 
                    "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                RETURNING 
                    id, "from", "to", cc, bcc, subject, body, html, status, 
                    error, "sentAt", "createdAt", "updatedAt"`,
        [
          data.from,
          data.to,
          data.cc || [],
          data.bcc || [],
          data.subject,
          data.body,
          data.html || null,
          data.status,
        ],
      );

      const emailRow = emailResult.rows[0];

      // Сохраняем вложения, если они есть
      const attachments: AttachmentEntity[] = [];
      if (data.attachments && data.attachments.length > 0) {
        for (const attachment of data.attachments) {
          //   const attachmentIdResult = await client.query<{ id: string }>(
          //     "SELECT gen_random_uuid() as id",
          //   );
          //   const attachmentId = attachmentIdResult.rows[0].id;

          await client.query(
            `INSERT INTO "attachments" (
                            "emailId", filename, "originalName", mimetype, size, path, "createdAt"
                        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              emailRow.id,
              attachment.filename,
              attachment.originalName,
              attachment.mimetype,
              attachment.size,
              attachment.path,
            ],
          );

          attachments.push(
            new AttachmentEntity({
              filename: attachment.filename,
              originalName: attachment.originalName,
              mimetype: attachment.mimetype,
              size: attachment.size,
              path: attachment.path,
            }),
          );
        }
      }

      // Возвращаем EmailEntity
      return new EmailEntity({
        id: emailRow.id,
        from: emailRow.from,
        to: emailRow.to,
        subject: emailRow.subject,
        body: emailRow.body,
        status: emailRow.status as EmailStatus,
        createdAt: emailRow.createdAt,
        updatedAt: emailRow.updatedAt,
        cc: emailRow.cc,
        bcc: emailRow.bcc,
        html: emailRow.html || undefined,
        attachments: attachments,
        sentAt: emailRow.sentAt || undefined,
        error: emailRow.error || undefined,
      });
    });
  }

  async findById(id: string): Promise<EmailEntity | null> {
    const emailResult = await this.query<EmailRow>(
      `SELECT 
        id, "from", "to", cc, bcc, subject, body, html, status, 
        error, "sentAt", "createdAt", "updatedAt"
       FROM "emails" 
       WHERE id = $1`,
      [id],
    );

    const emailRow = emailResult.rows[0];

    if (!emailRow) {
      return null;
    }

    // Загружаем вложения
    const attachmentsResult = await this.query<{
      id: string;
      filename: string;
      originalName: string;
      mimetype: string;
      size: number;
      path: string;
      createdAt: Date;
    }>(
      `SELECT id, filename, "originalName", mimetype, size, path, "createdAt"
       FROM "attachments" 
       WHERE "emailId" = $1`,
      [id],
    );

    const attachments = attachmentsResult.rows.map(
      (row) =>
        new AttachmentEntity({
          filename: row.filename,
          originalName: row.originalName,
          mimetype: row.mimetype,
          size: row.size,
          path: row.path,
        }),
    );

    // Возвращаем EmailEntity с вложениями
    return new EmailEntity({
      id: emailRow.id,
      from: emailRow.from,
      to: emailRow.to,
      subject: emailRow.subject,
      body: emailRow.body,
      status: emailRow.status as EmailStatus,
      createdAt: emailRow.createdAt,
      updatedAt: emailRow.updatedAt,
      cc: emailRow.cc,
      bcc: emailRow.bcc,
      html: emailRow.html || undefined,
      attachments: attachments,
      sentAt: emailRow.sentAt || undefined,
      error: emailRow.error || undefined,
    });
  }

  async update(data: UpdateEmailData): Promise<EmailEntity> {
    // Формируем динамический SQL запрос для обновления
    const updateFields: string[] = ["status = $1", '"updatedAt" = NOW()'];
    const values: any[] = [data.status];
    let paramIndex = 2;

    if (data.sentAt !== undefined) {
      updateFields.push(`"sentAt" = $${paramIndex}`);
      values.push(data.sentAt);
      paramIndex++;
    }

    if (data.error !== undefined) {
      updateFields.push(`error = $${paramIndex}`);
      values.push(data.error);
      paramIndex++;
    }

    // Добавляем id в конец для WHERE условия
    values.push(data.id);

    // Обновляем запись
    await this.query(
      `UPDATE "emails" 
       SET ${updateFields.join(", ")} 
       WHERE id = $${paramIndex}`,
      values,
    );

    // Получаем обновленную запись
    const emailResult = await this.query<EmailRow>(
      `SELECT 
        id, "from", "to", cc, bcc, subject, body, html, status, 
        error, "sentAt", "createdAt", "updatedAt"
       FROM "emails" 
       WHERE id = $1`,
      [data.id],
    );

    const emailRow = emailResult.rows[0];

    if (!emailRow) {
      throw new Error(`Email with id ${data.id} not found`);
    }

    // Загружаем вложения
    const attachmentsResult = await this.query<{
      id: string;
      filename: string;
      originalName: string;
      mimetype: string;
      size: number;
      path: string;
      createdAt: Date;
    }>(
      `SELECT id, filename, "originalName", mimetype, size, path, "createdAt"
       FROM "attachments" 
       WHERE "emailId" = $1`,
      [data.id],
    );

    const attachments = attachmentsResult.rows.map(
      (row) =>
        new AttachmentEntity({
          filename: row.filename,
          originalName: row.originalName,
          mimetype: row.mimetype,
          size: row.size,
          path: row.path,
        }),
    );

    // Возвращаем EmailEntity с вложениями
    return new EmailEntity({
      id: emailRow.id,
      from: emailRow.from,
      to: emailRow.to,
      subject: emailRow.subject,
      body: emailRow.body,
      status: emailRow.status as EmailStatus,
      createdAt: emailRow.createdAt,
      updatedAt: emailRow.updatedAt,
      cc: emailRow.cc,
      bcc: emailRow.bcc,
      html: emailRow.html || undefined,
      attachments: attachments,
      sentAt: emailRow.sentAt || undefined,
      error: emailRow.error || undefined,
    });
  }
}
