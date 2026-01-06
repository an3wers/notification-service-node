/**
 * Пример использования RPC паттерна с RabbitMQ
 *
 * Этот файл демонстрирует:
 * 1. Настройку двух микросервисов (NotificationService и UserService)
 * 2. RPC вызов из NotificationService к UserService
 * 3. Обработку запроса и отправку ответа
 */

import { RabbitMQService } from "../src/infrastructure/queue/rabbitmq.service";

// ============================================
// Типы данных
// ============================================

interface User {
  id: string;
  name: string;
  email: string;
  preferences: {
    emailNotifications: boolean;
    smsNotifications: boolean;
  };
}

interface NotificationRequest {
  userId: string;
  type: "email" | "sms";
  subject?: string;
  message: string;
}

// ============================================
// User Service (отвечает на RPC запросы)
// ============================================

async function startUserService() {
  const rabbitMQ = new RabbitMQService();
  await rabbitMQ.connect();

  console.log("👤 User Service started");

  // Мок база данных пользователей
  const users: Record<string, User> = {
    "123": {
      id: "123",
      name: "Алексей",
      email: "alexey@example.com",
      preferences: {
        emailNotifications: true,
        smsNotifications: false,
      },
    },
    "456": {
      id: "456",
      name: "Мария",
      email: "maria@example.com",
      preferences: {
        emailNotifications: true,
        smsNotifications: true,
      },
    },
  };

  // Слушаем запросы
  await rabbitMQ.consume("user-service-queue", async (message, context) => {
    console.log("👤 User Service received:", message);

    // Проверяем, это RPC запрос?
    if (context?.correlationId && context?.replyTo) {
      console.log(`👤 Processing RPC request: ${message.action}`);

      if (message.action === "getUser") {
        const user = users[message.userId];

        if (user) {
          // Отправляем успешный ответ
          await context.reply({
            success: true,
            data: user,
            error: null,
          });
          console.log(`👤 Sent user data for ${user.name}`);
        } else {
          // Отправляем ошибку
          await context.reply({
            success: false,
            data: null,
            error: "User not found",
          });
          console.log(`👤 User ${message.userId} not found`);
        }
      } else if (message.action === "ping") {
        // Health check
        await context.reply({ status: "ok", service: "user-service" });
        console.log("👤 Pong!");
      } else {
        await context.reply({
          success: false,
          data: null,
          error: "Unknown action",
        });
      }
    } else {
      // Обычное сообщение без ответа
      console.log("👤 Processing fire-and-forget message");
    }
  });

  return rabbitMQ;
}

// ============================================
// Notification Service (делает RPC запросы)
// ============================================

async function startNotificationService() {
  const rabbitMQ = new RabbitMQService();
  await rabbitMQ.connect();

  console.log("📧 Notification Service started");

  return rabbitMQ;
}

async function sendNotification(
  rabbitMQ: RabbitMQService,
  request: NotificationRequest,
) {
  console.log(
    `\n📧 Processing notification request for user ${request.userId}`,
  );

  try {
    // 1. Делаем RPC вызов к User Service для получения данных пользователя
    console.log("📧 Requesting user data via RPC...");

    const response = await rabbitMQ.sendRPC<{
      success: boolean;
      data?: User;
      error?: string;
    }>(
      "user-service-queue",
      {
        action: "getUser",
        userId: request.userId,
      },
      {
        timeout: 5000, // 5 секунд таймаут
      },
    );

    if (!response.success || !response.data) {
      console.error(`📧 Failed to get user data: ${response.error}`);
      return;
    }

    const user = response.data;
    console.log(`📧 Received user data: ${user.name} (${user.email})`);

    // 2. Проверяем preferences пользователя
    if (request.type === "email" && !user.preferences.emailNotifications) {
      console.log(`📧 User ${user.name} has email notifications disabled`);
      return;
    }

    if (request.type === "sms" && !user.preferences.smsNotifications) {
      console.log(`📧 User ${user.name} has SMS notifications disabled`);
      return;
    }

    // 3. Отправляем уведомление
    if (request.type === "email") {
      console.log(`📧 Sending email to ${user.email}`);
      console.log(`   Subject: ${request.subject}`);
      console.log(`   Message: ${request.message}`);
      console.log(`📧 ✅ Email sent successfully!`);
    } else {
      console.log(`📧 Sending SMS notification`);
      console.log(`   Message: ${request.message}`);
      console.log(`📧 ✅ SMS sent successfully!`);
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        console.error("📧 ❌ User Service timeout - service unavailable");
      } else {
        console.error("📧 ❌ Error:", error.message);
      }
    }
  }
}

// ============================================
// Пример: Health Check
// ============================================

async function healthCheck(rabbitMQ: RabbitMQService) {
  console.log("\n🏥 Performing health check...");

  try {
    const response = await rabbitMQ.sendRPC(
      "user-service-queue",
      { action: "ping" },
      { timeout: 2000 },
    );

    console.log(`🏥 User Service health: ${response.status}`);
    return true;
  } catch (error) {
    console.error("🏥 User Service is DOWN");
    return false;
  }
}

// ============================================
// Пример: Параллельные RPC вызовы
// ============================================

async function sendBulkNotifications(
  rabbitMQ: RabbitMQService,
  userIds: string[],
) {
  console.log(`\n📧 Sending bulk notifications to ${userIds.length} users`);

  try {
    // Получаем данные всех пользователей параллельно
    const userRequests = userIds.map((userId) =>
      rabbitMQ
        .sendRPC<{ success: boolean; data?: User }>(
          "user-service-queue",
          {
            action: "getUser",
            userId,
          },
          { timeout: 5000 },
        )
        .catch((error) => ({
          success: false,
          data: null,
          error: error.message,
        })),
    );

    const responses = await Promise.all(userRequests);

    // Обрабатываем успешные ответы
    const users = responses
      .filter((r) => r.success && r.data)
      .map((r) => r.data!);

    console.log(`📧 Successfully fetched data for ${users.length} users`);
    users.forEach((user) => {
      console.log(`   - ${user.name} (${user.email})`);
    });

    return users;
  } catch (error) {
    console.error("📧 Bulk notifications failed:", error);
    return [];
  }
}

// ============================================
// Main - Запуск примера
// ============================================

async function main() {
  console.log("🚀 Starting RPC Example...\n");

  // Запускаем оба сервиса
  const userService = await startUserService();
  const notificationService = await startNotificationService();

  // Даем время на инициализацию
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // ============================================
  // Пример 1: Health Check
  // ============================================
  await healthCheck(notificationService);

  // ============================================
  // Пример 2: Отправка уведомления существующему пользователю
  // ============================================
  await sendNotification(notificationService, {
    userId: "123",
    type: "email",
    subject: "Добро пожаловать!",
    message: "Спасибо за регистрацию в нашем сервисе",
  });

  // ============================================
  // Пример 3: Отправка уведомления несуществующему пользователю
  // ============================================
  await sendNotification(notificationService, {
    userId: "999",
    type: "email",
    subject: "Test",
    message: "This should fail",
  });

  // ============================================
  // Пример 4: Параллельные запросы
  // ============================================
  await sendBulkNotifications(notificationService, ["123", "456", "789"]);

  // ============================================
  // Пример 5: Timeout
  // ============================================
  console.log("\n⏱️  Testing timeout...");
  try {
    // Останавливаем User Service для демонстрации timeout
    await userService.close();
    console.log("👤 User Service stopped");

    // Пытаемся сделать RPC вызов
    await notificationService.sendRPC(
      "user-service-queue",
      { action: "getUser", userId: "123" },
      { timeout: 2000 },
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`⏱️  Expected timeout error: ${error.message}`);
    }
  }

  // Завершение
  console.log("\n🏁 Example completed!");
  await notificationService.close();
  process.exit(0);
}

// Запуск
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { startUserService, startNotificationService, sendNotification };
