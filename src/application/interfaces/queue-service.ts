import type { MessageContext, PublishOptions, RPCOptions } from "../../infrastructure/queue/rabbitmq.service.ts";

export interface QueueService {
  connect(): Promise<void>;
  
  publish(queue: string, message: any, options?: PublishOptions): Promise<void>;
  
  consume(
    queue: string,
    handler: (message: any, context?: MessageContext) => Promise<void>,
  ): Promise<void>;
  
  sendRPC<T = any>(
    queue: string,
    message: any,
    options?: RPCOptions,
  ): Promise<T>;
  
  sendRPCReply(
    replyTo: string,
    correlationId: string,
    response: any,
  ): Promise<void>;
  
  close(): Promise<void>;
}
