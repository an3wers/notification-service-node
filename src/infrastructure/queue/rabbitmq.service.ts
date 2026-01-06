import amqp, { type Channel, type ChannelModel, type Message } from "amqplib";
import { config } from "../../config/env.ts";
import type { QueueService } from "../../application/interfaces/queue-service.ts";
import { randomUUID } from "crypto";

export interface RPCOptions {
  timeout?: number; // timeout в миллисекундах
  correlationId?: string;
}

export interface PublishOptions {
  replyTo?: string;
  correlationId?: string;
  persistent?: boolean;
  expiration?: string;
}

export interface MessageContext {
  replyTo?: string;
  correlationId?: string;
  timestamp?: number;
  reply: (response: any) => Promise<void>;
}

export class RabbitMQService implements QueueService {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private replyQueue: string | null = null;
  private pendingRPCRequests: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeoutId: NodeJS.Timeout;
    }
  > = new Map();

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);

      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(config.rabbitmq.exchange, "direct", {
        durable: true,
      });

      await this.channel.assertQueue(config.rabbitmq.queue, {
        durable: true,
      });

      await this.channel.bindQueue(
        config.rabbitmq.queue,
        config.rabbitmq.exchange,
        config.rabbitmq.routingKey,
      );

      // Инициализация reply queue для RPC паттерна
      await this.initializeReplyQueue();

      console.log("Connected to RabbitMQ");
    } catch (error) {
      console.error("Failed to connect to RabbitMQ:", error);
      throw error;
    }
  }

  /**
   * Инициализирует эксклюзивную очередь для получения ответов (RPC паттерн)
   */
  private async initializeReplyQueue(): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    // Создаем временную эксклюзивную очередь для ответов
    const reply = await this.channel.assertQueue("", {
      exclusive: true, // автоматически удалится при закрытии соединения
      autoDelete: true,
    });

    this.replyQueue = reply.queue;

    // Слушаем ответы в reply queue
    await this.channel.consume(
      this.replyQueue,
      (msg) => {
        if (msg) {
          this.handleRPCReply(msg);
        }
      },
      { noAck: true }, // автоматически подтверждаем получение ответов
    );
  }

  /**
   * Обработчик ответов RPC
   */
  private handleRPCReply(msg: Message): void {
    const correlationId = msg.properties.correlationId;

    if (!correlationId) {
      console.warn("Received reply without correlationId");
      return;
    }

    const pendingRequest = this.pendingRPCRequests.get(correlationId);

    if (pendingRequest) {
      clearTimeout(pendingRequest.timeoutId);
      this.pendingRPCRequests.delete(correlationId);

      try {
        const content = JSON.parse(msg.content.toString());
        pendingRequest.resolve(content);
      } catch (error) {
        pendingRequest.reject(new Error(`Failed to parse RPC reply: ${error}`));
      }
    }
  }

  async publish(
    queue: string,
    message: any,
    options?: PublishOptions,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));

    const publishOptions: any = {
      persistent: options?.persistent ?? true,
    };

    // Добавляем replyTo если указан
    if (options?.replyTo) {
      publishOptions.replyTo = options.replyTo;
    }

    // Добавляем correlationId если указан
    if (options?.correlationId) {
      publishOptions.correlationId = options.correlationId;
    }

    // Добавляем expiration если указан
    if (options?.expiration) {
      publishOptions.expiration = options.expiration;
    }

    this.channel.publish(
      config.rabbitmq.exchange,
      config.rabbitmq.routingKey,
      messageBuffer,
      publishOptions,
    );
  }

  /**
   * RPC вызов с ожиданием ответа
   * @param queue - целевая очередь
   * @param message - сообщение для отправки
   * @param options - опции RPC (timeout, correlationId)
   * @returns Promise с ответом от другого микросервиса
   */
  async sendRPC<T = any>(
    queue: string,
    message: any,
    options?: RPCOptions,
  ): Promise<T> {
    if (!this.channel || !this.replyQueue) {
      throw new Error("RabbitMQ not properly initialized for RPC");
    }

    const correlationId = options?.correlationId || randomUUID();
    const timeout = options?.timeout || 30000; // по умолчанию 30 секунд

    return new Promise<T>((resolve, reject) => {
      // Устанавливаем таймаут
      const timeoutId = setTimeout(() => {
        this.pendingRPCRequests.delete(correlationId);
        reject(new Error(`RPC timeout after ${timeout}ms`));
      }, timeout);

      // Сохраняем pending запрос
      this.pendingRPCRequests.set(correlationId, {
        resolve,
        reject,
        timeoutId,
      });

      // Отправляем сообщение с указанием replyTo и correlationId
      this.publish(queue, message, {
        replyTo: this.replyQueue || undefined,
        correlationId,
        expiration: timeout.toString(), // TTL сообщения
      }).catch((error) => {
        clearTimeout(timeoutId);
        this.pendingRPCRequests.delete(correlationId);
        reject(error);
      });
    });
  }

  /**
   * Отправка ответа на RPC запрос
   * @param replyTo - очередь для ответа (из msg.properties.replyTo)
   * @param correlationId - ID корреляции (из msg.properties.correlationId)
   * @param response - данные ответа
   */
  async sendRPCReply(
    replyTo: string,
    correlationId: string,
    response: any,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    const messageBuffer = Buffer.from(JSON.stringify(response));

    this.channel.sendToQueue(replyTo, messageBuffer, {
      correlationId,
    });
  }

  async consume(
    queue: string,
    handler: (message: any, context?: MessageContext) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    await this.channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());

          // Передаем контекст сообщения для возможности ответа
          const context: MessageContext = {
            replyTo: msg.properties.replyTo,
            correlationId: msg.properties.correlationId,
            timestamp: msg.properties.timestamp,
            // Хелпер для отправки ответа
            reply: async (response: any) => {
              if (msg.properties.replyTo && msg.properties.correlationId) {
                await this.sendRPCReply(
                  msg.properties.replyTo,
                  msg.properties.correlationId,
                  response,
                );
              }
            },
          };

          await handler(content, context);
          this.channel!.ack(msg);
        } catch (error) {
          console.error("Error processing message:", error);
          this.channel!.nack(msg, false, false);
        }
      }
    });
  }

  async close(): Promise<void> {
    // Отклоняем все pending RPC запросы
    for (const [correlationId, request] of this.pendingRPCRequests) {
      clearTimeout(request.timeoutId);
      request.reject(new Error("RabbitMQ connection closed"));
    }
    this.pendingRPCRequests.clear();

    await this.channel?.close();
    await this.connection?.close();

    this.channel = null;
    this.connection = null;
    this.replyQueue = null;
  }
}
