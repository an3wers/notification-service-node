export interface AttachmentEntity {
  id: string;
  emailId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  url: string | null;
  createdAt: Date;
}
