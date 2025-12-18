import { Router } from "express";
import { EmailsController } from "../presenters/emails.controller.ts";
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
      upload.array("files", 30),
      this.emailsController.sendEmail.bind(this.emailsController),
    );

    this._router.get(
      "/:id",
      this.emailsController.getEmailDetails.bind(this.emailsController),
    );

    return this._router;
  }
}
