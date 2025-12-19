import { unlink } from "fs/promises";
import type { AttachmentEntity } from "../domain/attachment.entity.ts";
import path from "path";

export class StorageService {
  async deleteAttachment(attachment: AttachmentEntity): Promise<void> {
    try {
      const absolutePath = path.resolve(attachment.path);
      await unlink(absolutePath);
    } catch (error) {
      // Если файл не существует (ENOENT), игнорируем ошибку
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
