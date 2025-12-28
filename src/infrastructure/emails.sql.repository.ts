import { BaseRepository, type PoolClient } from "../libs/db-client.ts";
import type { EmailsRepository } from "../application/interfaces/emails-repository.ts";
import type { SaveEmailData } from "../application/types/save-email-data.ts";
import { type EmailEntity } from "../domain/email.entity.ts";
import type { UpdateEmailData } from "../application/types/update-email-data.ts";
import { type AttachmentEntity } from "../domain/attachment.entity.ts";
import { EmailStatus } from "../domain/types.ts";

interface EmailRow {
  id: string;
  from: string;
  display_name: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  html: string | null;
  status: string;
  error: string | null;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface AttachmentRow {
  id: string;
  email_id: string;
  filename: string;
  original_name: string;
  mimetype: string;
  size: number;
  path: string;
  url: string | null;
  created_at: Date;
}

export class EmailsSqlRepository
  extends BaseRepository
  implements EmailsRepository
{
  async save(data: SaveEmailData): Promise<EmailEntity> {
    return await this.transaction(async (client: PoolClient) => {
      const emailResult = await client.query<EmailRow>(
        `INSERT INTO "emails" (
                    "from", "to", "display_name", cc, bcc, subject, body, html, status, 
                    "created_at", "updated_at"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                RETURNING *`,
        [
          data.from,
          data.to,
          data.displayName,
          data.cc || [],
          data.bcc || [],
          data.subject,
          data.body,
          data.html || null,
          data.status,
        ],
      );

      const emailRow = emailResult.rows[0];

      const attachments: AttachmentEntity[] = [];

      if (data.attachments && data.attachments.length > 0) {
        for (const attachment of data.attachments) {
          const attachmentResult = await client.query<AttachmentRow>(
            `INSERT INTO "attachments" (
                            "email_id", filename, "original_name", mimetype, size, path, url, "created_at"
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                         RETURNING *`,
            [
              emailRow.id,
              attachment.filename,
              attachment.originalName,
              attachment.mimetype,
              attachment.size,
              attachment.path,
              attachment.url,
            ],
          );

          const attachmentRow = attachmentResult.rows[0];
          attachments.push(this.mapRowToAttachment(attachmentRow));
        }
      }

      return this.mapRowToEmail(emailRow, attachments);
    });
  }

  async findById(id: string): Promise<EmailEntity | null> {
    const emailResult = await this.query<EmailRow>(
      `SELECT * FROM "emails" 
       WHERE id = $1`,
      [id],
    );

    const emailRow = emailResult.rows[0];

    if (!emailRow) {
      return null;
    }

    const attachmentsResult = await this.query<AttachmentRow>(
      `SELECT *
       FROM "attachments" 
       WHERE "email_id" = $1`,
      [id],
    );

    const attachments = attachmentsResult.rows.map((row) =>
      this.mapRowToAttachment(row),
    );

    return this.mapRowToEmail(emailRow, attachments);
  }

  async update(data: UpdateEmailData): Promise<EmailEntity> {
    const updateFields: string[] = ["status = $1", '"updated_at" = NOW()'];

    const values: any[] = [data.status];

    let paramIndex = 2;

    if (data.sentAt !== undefined) {
      updateFields.push(`"sent_at" = $${paramIndex}`);
      values.push(data.sentAt);
      paramIndex++;
    }

    if (data.error !== undefined) {
      updateFields.push(`error = $${paramIndex}`);
      values.push(data.error);
      paramIndex++;
    }

    values.push(data.id);

    await this.query(
      `UPDATE "emails" 
       SET ${updateFields.join(", ")} 
       WHERE id = $${paramIndex}`,
      values,
    );

    const emailResult = await this.query<EmailRow>(
      `SELECT *
       FROM "emails" 
       WHERE id = $1`,
      [data.id],
    );

    const emailRow = emailResult.rows[0];

    if (!emailRow) {
      throw new Error(`Email with id ${data.id} not found`);
    }

    const attachmentsResult = await this.query<AttachmentRow>(
      `SELECT *
       FROM "attachments" 
       WHERE "email_id" = $1`,
      [data.id],
    );

    const attachments = attachmentsResult.rows.map((row) =>
      this.mapRowToAttachment(row),
    );

    return this.mapRowToEmail(emailRow, attachments);
  }

  findAll(): Promise<{
    emails: EmailEntity[];
    count: number;
    page: number;
    limit: number;
    total: number;
  }> {
    throw new Error("Method not implemented.");
  }

  async deleteSoft(id: string): Promise<EmailEntity | null> {
    // TODO: use transaction
    const emailResult = await this.query<EmailRow>(
      `UPDATE "emails" SET "deleted_at" = NOW(), "updated_at" = NOW()
       WHERE "id" = $1 AND "deleted_at" IS NULL
       RETURNING *`,
      [id],
    );

    const emailRow = emailResult.rows[0];

    if (!emailRow) {
      return null;
    }

    const attachmentsResult = await this.query<AttachmentRow>(
      `SELECT *
       FROM "attachments" 
       WHERE "email_id" = $1`,
      [id],
    );

    const attachments = attachmentsResult.rows.map((row) =>
      this.mapRowToAttachment(row),
    );

    return this.mapRowToEmail(emailRow, attachments);
  }

  async deleteHard(id: string): Promise<void> {
    await this.transaction(async (client: PoolClient) => {
      await client.query(`DELETE FROM "attachments" WHERE "email_id" = $1`, [
        id,
      ]);
      await client.query(`DELETE FROM "emails" WHERE "id" = $1`, [id]);
    });
  }

  async getEmailsIdOlderThan(days: number): Promise<string[]> {
    const emailsResult = await this.query<EmailRow>(
      `SELECT * FROM "emails" WHERE "created_at" < NOW() - INTERVAL '${days} days'`,
    );

    const emails = emailsResult.rows;

    if (emails.length === 0) {
      return [];
    }

    // Получаем все id писем, чтобы достать их вложения пачкой
    const emailIds = emails.map((row) => row.id);

    return emailIds;

    // let attachmentsByEmailId: Record<string, AttachmentEntity[]> = {};

    // if (emailIds.length > 0) {
    //   const attachmentsResult = await this.query<AttachmentRow>(
    //     `SELECT * FROM "attachments" WHERE "email_id" = ANY($1)`,
    //     [emailIds]
    //   );

    //   attachmentsByEmailId = attachmentsResult.rows.reduce<Record<string, AttachmentEntity[]>>((acc, row) => {
    //     const mapped = this.mapRowToAttachment(row);
    //     if (!acc[row.email_id]) acc[row.email_id] = [];
    //     acc[row.email_id].push(mapped);
    //     return acc;
    //   }, {});
    // }

    // return emails.map(emailRow =>
    //   this.mapRowToEmail(emailRow, attachmentsByEmailId[emailRow.id] || [])
    // );
  }

  private mapRowToEmail(
    emailRow: EmailRow,
    attachments: AttachmentEntity[],
  ): EmailEntity {
    return {
      id: emailRow.id,
      from: emailRow.from,
      to: emailRow.to,
      displayName: emailRow.display_name,
      subject: emailRow.subject,
      body: emailRow.body,
      status: emailRow.status as EmailStatus,
      createdAt: emailRow.created_at,
      updatedAt: emailRow.updated_at,
      cc: emailRow.cc,
      bcc: emailRow.bcc,
      html: emailRow.html || null,
      attachments: attachments,
      sentAt: emailRow.sent_at || null,
      error: emailRow.error || null,
      deletedAt: emailRow.deleted_at || null,
    };
  }

  private mapRowToAttachment(attachmentRow: AttachmentRow): AttachmentEntity {
    return {
      id: attachmentRow.id,
      emailId: attachmentRow.email_id,
      filename: attachmentRow.filename,
      originalName: attachmentRow.original_name,
      mimetype: attachmentRow.mimetype,
      size: attachmentRow.size,
      path: attachmentRow.path,
      url: attachmentRow.url,
      createdAt: attachmentRow.created_at,
    };
  }
}
