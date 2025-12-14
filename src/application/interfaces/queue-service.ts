export interface QueueService {
  connect(): Promise<void>;
  publish(queue: string, message: any): Promise<void>;
  consume(
    queue: string,
    handler: (message: any) => Promise<void>,
  ): Promise<void>;
  close(): Promise<void>;
}
