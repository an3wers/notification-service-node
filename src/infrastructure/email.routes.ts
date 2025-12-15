import { Router } from "express";
import { EmailsController } from "../presenters/emails.controller.ts";
import { EmailsService } from "../application/emails.servise.ts";
import type { EmailsRepository } from "../application/interfaces/emails.repository.ts";
import type { EmailProvider } from "../application/interfaces/email-provider.ts";
import { upload } from "../config/multer.config.ts";

export class EmailRouter {
  private _router: Router;
  private emailsController: EmailsController;

  constructor(emailsController: EmailsController) {
    this.emailsController = emailsController;
    this._router = Router();
  }

  get router() {
    this._router.post(
      "/",
      upload.array("files", 20),
      this.emailsController.sendEmail,
    );

    this._router.get("/:id", this.emailsController.getEmailDetails);

    return this._router;
  }
}
