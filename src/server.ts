import express, { type Express } from "express";
import cors from "cors";
import { config } from "./config/env.ts";
import { errorHandler } from "./presenters/middleware/error-handler.middleware.ts";

import { createDatabaseConfig, DatabasePool } from "./libs/db-client.ts";

import { EmailRouter } from "./infrastructure/email.routes.ts";
import { EmailsSqlRepository } from "./infrastructure/emails.sql.repository.ts";
import { NodemailerProvider } from "./infrastructure/nodemailer-provider.ts";
import { EmailsController } from "./presenters/emails.controller.ts";
import { EmailsService } from "./application/emails.service.ts";
// import { RabbitMQService } from "./infrastructure/queue/rabbitmq.service.ts";
// import { EmailConsumer } from "./infrastructure/queue/email-consumer.ts";

let db: DatabasePool;
const app: Express = express();

try {
  app.use(
    cors({
      origin: config.origin,
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // db
  db = new DatabasePool(createDatabaseConfig());

  // health check
  app.get("/api/health", async (req, res) => {
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      service: "Email service",
    });
  });

  // routes

  // dependencies
  const emailsRepository = new EmailsSqlRepository(db);
  const emailProvider = new NodemailerProvider();
  const emailsService = new EmailsService(emailsRepository, emailProvider);
  const emailsController = new EmailsController(emailsService);

  app.use("/api/v1/emails", new EmailRouter(emailsController).router);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: "Route not found",
      path: req.originalUrl,
    });
  });

  app.use(errorHandler);

  // RabbitMQ Consumer
  // const queueService = new RabbitMQService();
  // await queueService.connect();

  // const emailConsumer = new EmailConsumer(queueService, emailsService);
  // await emailConsumer.start();
} catch (error) {
  console.error(error);
  throw error;
}

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing database connection...");
  await db.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing database connection...");
  await db.close();
  process.exit(0);
});

export { app };

export default app;
