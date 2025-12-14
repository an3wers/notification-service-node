export class AttachmentEntity {
  public readonly filename: string;
  public readonly originalName: string;
  public readonly mimetype: string;
  public readonly size: number;
  public readonly path: string;

  constructor(data: AttachmentEntity) {
    this.filename = data.filename;
    this.originalName = data.originalName;
    this.mimetype = data.mimetype;
    this.size = data.size;
    this.path = data.path;
  }
}
