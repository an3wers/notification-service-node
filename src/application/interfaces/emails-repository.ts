import type { EmailEntity } from "../../domain/email.entity.ts";
import type { SaveEmailData } from "../types/save-email-data.ts";
import type { UpdateEmailData } from "../types/update-email-data.ts";

export interface EmailsRepository {
  save(data: SaveEmailData): Promise<EmailEntity>;

  findById(id: string): Promise<EmailEntity | null>;

  findAll(): Promise<{
    emails: EmailEntity[];
    count: number;
    page: number;
    limit: number;
    total: number;
  }>;

  update(data: UpdateEmailData): Promise<EmailEntity | null>;

  deleteSoft(id: string): Promise<EmailEntity | null>;

  deleteHard(id: string): Promise<void>;
}
