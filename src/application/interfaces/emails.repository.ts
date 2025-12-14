import type { EmailEntity } from "../../domain/email.entity.ts";
import type { SaveEmailData } from "../types/save-email-data.ts";
import type { UpdateEmailData } from "../types/update-email-data.ts";

export interface EmailsRepository {
  save(data: SaveEmailData): Promise<EmailEntity>;
  findById(id: string): Promise<EmailEntity | null>;
  update(data: UpdateEmailData): Promise<EmailEntity>;
}
