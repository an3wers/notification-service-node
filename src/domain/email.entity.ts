import type { AttachmentEntity } from "./attachment.entity.ts";
import type { EmailStatus } from "./types.ts";

export class EmailEntity {
  public readonly id: string;
  public readonly from: string;
  public readonly to: string[];
  public readonly subject: string;
  public readonly body: string;
  public readonly status: EmailStatus;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly cc: string[] = [];
  public readonly bcc: string[] = [];
  public readonly html?: string;
  public readonly attachments: AttachmentEntity[] = [];
  public readonly sentAt?: Date;
  public readonly error?: string;

  constructor(data: EmailEntity) {
    this.id = data.id;
    this.from = data.from;
    this.to = data.to;
    this.subject = data.subject;
    this.body = data.body;
    this.status = data.status;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.cc = data.cc;
    this.bcc = data.bcc;
    this.html = data.html;
    this.attachments = data.attachments;
    this.sentAt = data.sentAt;
    this.error = data.error;
  }
}
