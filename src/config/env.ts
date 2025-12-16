import { config as dotenvConfig } from "dotenv";

dotenvConfig();

export const config = {
  origin: process.env.ORIGIN || "*",
  port: Number(process.env.PORT) || 3008,
  serviceDomain: process.env.SERVICE_DOMAIN || "",
  nodeEnv: process.env.NODE_ENV || "development",
  apiUrl:
    process.env.NODE_ENV === "production"
      ? process.env.API_URL_PROD
      : process.env.API_URL_DEV,

  smtp: {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASSWORD!,
    },
    from: process.env.SMTP_FROM || "noreply@example.com",
    displayName: process.env.SMTP_FROM_DISPLAY_NAME || "Email Service",
    connectionTimeout: parseInt(
      process.env.SMTP_CONNECTION_TIMEOUT || "30000",
      10,
    ),
    greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT || "20000", 10),
    socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT || "20000", 10),
    dnsTimeout: parseInt(process.env.SMTP_DNS_TIMEOUT || "20000", 10),
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL || "amqp://localhost:5672",
    queue: process.env.RABBITMQ_QUEUE || "email.send",
    exchange: "email.exchange",
    routingKey: "email.send",
  },

  secretKey: process.env.SECRET_KEY || "",

  storage: {
    uploadDir: process.env.UPLOAD_DIR || "./uploads",
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10), // 10MB
  },
};
