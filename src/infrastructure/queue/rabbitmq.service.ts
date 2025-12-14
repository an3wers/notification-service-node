import amqp, { type Channel, type ChannelModel } from "amqplib";
import { config } from "../../config/env.ts";
import type { QueueService } from "../../application/interfaces/queue-service.ts";

export class RabbitMQService implements QueueService {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

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

      console.log("Connected to RabbitMQ");
    } catch (error) {
      console.error("Failed to connect to RabbitMQ:", error);
      throw error;
    }
  }

  async publish(queue: string, message: any): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    this.channel.sendToQueue(queue, messageBuffer, { persistent: true });
  }

  async consume(
    queue: string,
    handler: (message: any) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    await this.channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content);
          this.channel!.ack(msg);
        } catch (error) {
          console.error("Error processing message:", error);
          this.channel!.nack(msg, false, false);
        }
      }
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
