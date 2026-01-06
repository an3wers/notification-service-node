# RabbitMQ RPC Pattern - Примеры использования

## Обзор

RabbitMQService теперь поддерживает паттерн RPC (Remote Procedure Call) для взаимодействия между микросервисами с получением ответа.

## Основные возможности

1. **Простая публикация сообщений** - отправка без ожидания ответа
2. **RPC вызовы** - отправка с ожиданием ответа от другого сервиса
3. **Обработка RPC запросов** - получение и ответ на запросы от других сервисов

---

## 1. Простая публикация сообщений (Fire-and-Forget)

### Базовая публикация

```typescript
const rabbitMQ = new RabbitMQService();
await rabbitMQ.connect();

// Простая публикация без ожидания ответа
await rabbitMQ.publish('notifications', {
  type: 'email',
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Welcome to our service'
});
```

### Публикация с дополнительными опциями

```typescript
await rabbitMQ.publish('notifications', {
  type: 'sms',
  phone: '+1234567890',
  message: 'Your code: 123456'
}, {
  persistent: true,
  expiration: '60000' // TTL 60 секунд
});
```

---

## 2. RPC вызовы (Request-Reply Pattern)

### Сценарий: Сервис уведомлений запрашивает данные пользователя

```typescript
// notification-service/src/services/notification.service.ts

class NotificationService {
  constructor(private rabbitMQ: RabbitMQService) {}

  async sendNotification(userId: string) {
    try {
      // Делаем RPC вызов к user-service для получения данных пользователя
      const user = await this.rabbitMQ.sendRPC<UserData>(
        'user-service-queue',
        {
          action: 'getUserData',
          userId: userId
        },
        {
          timeout: 5000 // 5 секунд таймаут
        }
      );

      console.log('Received user data:', user);

      // Теперь можем отправить уведомление с данными пользователя
      await this.sendEmail(user.email, user.name);

    } catch (error) {
      if (error.message.includes('timeout')) {
        console.error('User service не ответил вовремя');
      } else {
        console.error('Error getting user data:', error);
      }
    }
  }
}
```

### Сценарий: Проверка доступности микросервиса

```typescript
async function checkServiceHealth(serviceName: string): Promise<boolean> {
  try {
    const response = await rabbitMQ.sendRPC(
      `${serviceName}-queue`,
      { action: 'ping' },
      { timeout: 2000 }
    );

    return response.status === 'ok';
  } catch (error) {
    return false;
  }
}

// Использование
const isUserServiceAlive = await checkServiceHealth('user-service');
console.log('User service status:', isUserServiceAlive);
```

---

## 3. Обработка RPC запросов (Ответ на запросы)

### Сервис пользователей обрабатывает запросы

```typescript
// user-service/src/index.ts

const rabbitMQ = new RabbitMQService();
await rabbitMQ.connect();

// Слушаем входящие запросы
await rabbitMQ.consume('user-service-queue', async (message, context) => {
  console.log('Received request:', message);

  // Проверяем, является ли это RPC запросом
  if (context?.correlationId && context?.replyTo) {
    
    // Обрабатываем запрос
    if (message.action === 'getUserData') {
      const userData = await getUserFromDatabase(message.userId);
      
      // Отправляем ответ обратно
      await context.reply({
        success: true,
        data: userData
      });
    } else if (message.action === 'ping') {
      await context.reply({ status: 'ok' });
    } else {
      await context.reply({
        success: false,
        error: 'Unknown action'
      });
    }
  } else {
    // Обычное сообщение без ожидания ответа
    console.log('Processing fire-and-forget message');
  }
});
```

### Альтернативный способ ответа (ручной)

```typescript
await rabbitMQ.consume('user-service-queue', async (message, context) => {
  if (context?.replyTo && context?.correlationId) {
    const result = await processRequest(message);
    
    // Ручная отправка ответа
    await rabbitMQ.sendRPCReply(
      context.replyTo,
      context.correlationId,
      result
    );
  }
});
```

---

## 4. Комплексный пример: Payment Gateway

### Payment Service (запрашивает валидацию)

```typescript
// payment-service/src/services/payment.service.ts

class PaymentService {
  constructor(private rabbitMQ: RabbitMQService) {}

  async processPayment(orderId: string, amount: number, cardToken: string) {
    try {
      // 1. Запрашиваем валидацию у fraud-detection сервиса
      const fraudCheck = await this.rabbitMQ.sendRPC<FraudCheckResult>(
        'fraud-detection-queue',
        {
          action: 'validateTransaction',
          orderId,
          amount,
          cardToken
        },
        { timeout: 3000 }
      );

      if (!fraudCheck.isValid) {
        throw new Error('Transaction blocked: ' + fraudCheck.reason);
      }

      // 2. Запрашиваем данные заказа у order-service
      const order = await this.rabbitMQ.sendRPC<OrderData>(
        'order-service-queue',
        {
          action: 'getOrder',
          orderId
        },
        { timeout: 5000 }
      );

      // 3. Обрабатываем платеж
      const paymentResult = await this.chargeCard(cardToken, amount);

      // 4. Уведомляем order-service об успешной оплате (fire-and-forget)
      await this.rabbitMQ.publish('order-service-queue', {
        action: 'updateOrderStatus',
        orderId,
        status: 'paid',
        paymentId: paymentResult.id
      });

      return { success: true, paymentId: paymentResult.id };

    } catch (error) {
      console.error('Payment processing failed:', error);
      throw error;
    }
  }
}
```

### Fraud Detection Service (обрабатывает валидацию)

```typescript
// fraud-detection-service/src/index.ts

const rabbitMQ = new RabbitMQService();
await rabbitMQ.connect();

await rabbitMQ.consume('fraud-detection-queue', async (message, context) => {
  if (message.action === 'validateTransaction' && context) {
    
    // Выполняем проверку на мошенничество
    const result = await performFraudCheck({
      orderId: message.orderId,
      amount: message.amount,
      cardToken: message.cardToken
    });

    // Отправляем результат обратно
    await context.reply({
      isValid: result.score > 0.8,
      reason: result.score <= 0.8 ? 'High fraud risk' : null,
      score: result.score
    });
  }
});
```

---

## 5. Обработка ошибок и таймаутов

```typescript
async function safeRPCCall<T>(
  rabbitMQ: RabbitMQService,
  queue: string,
  message: any,
  defaultValue: T
): Promise<T> {
  try {
    return await rabbitMQ.sendRPC<T>(queue, message, {
      timeout: 5000
    });
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.warn(`Service ${queue} timed out, using default value`);
    } else if (error.message.includes('connection closed')) {
      console.error('RabbitMQ connection lost');
    } else {
      console.error('RPC call failed:', error);
    }
    return defaultValue;
  }
}

// Использование
const userData = await safeRPCCall(
  rabbitMQ,
  'user-service-queue',
  { action: 'getUser', userId: '123' },
  { id: '123', name: 'Unknown', email: 'unknown@example.com' } // значение по умолчанию
);
```

---

## 6. Параллельные RPC вызовы

```typescript
async function enrichNotificationData(notificationId: string) {
  // Делаем несколько RPC вызовов параллельно
  const [user, preferences, template] = await Promise.all([
    rabbitMQ.sendRPC('user-service-queue', {
      action: 'getUser',
      userId: '123'
    }),
    rabbitMQ.sendRPC('preferences-service-queue', {
      action: 'getPreferences',
      userId: '123'
    }),
    rabbitMQ.sendRPC('template-service-queue', {
      action: 'getTemplate',
      type: 'welcome'
    })
  ]);

  return {
    user,
    preferences,
    template
  };
}
```

---

## 7. Graceful Shutdown

```typescript
// Правильное завершение работы с RabbitMQ

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  try {
    // Все pending RPC запросы будут автоматически отклонены
    await rabbitMQ.close();
    console.log('RabbitMQ connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});
```

---

## 8. Типизация TypeScript

```typescript
// types/rpc.types.ts

export interface GetUserRequest {
  action: 'getUser';
  userId: string;
}

export interface GetUserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface ValidateTransactionRequest {
  action: 'validateTransaction';
  orderId: string;
  amount: number;
  cardToken: string;
}

export interface ValidateTransactionResponse {
  isValid: boolean;
  reason: string | null;
  score: number;
}

// Использование с типами
const user = await rabbitMQ.sendRPC<GetUserResponse>(
  'user-service-queue',
  {
    action: 'getUser',
    userId: '123'
  } as GetUserRequest
);

console.log(user.name); // TypeScript знает структуру
```

---

## Лучшие практики

1. **Устанавливайте разумные таймауты** - не делайте их слишком большими
2. **Обрабатывайте ошибки** - всегда используйте try-catch для RPC вызовов
3. **Используйте типизацию** - определяйте интерфейсы для запросов и ответов
4. **Логируйте correlationId** - помогает трейсить запросы между сервисами
5. **Graceful shutdown** - корректно закрывайте соединения
6. **Избегайте бесконечных цепочек** - RPC A -> B -> C -> D может привести к проблемам
7. **Кэшируйте данные** - не делайте RPC вызов каждый раз, если данные редко меняются

---

## Архитектурные паттерны

### Circuit Breaker для RPC

```typescript
class CircuitBreaker {
  private failures = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 минута
  private isOpen = false;
  private resetTimer: NodeJS.Timeout | null = null;

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.openCircuit();
    }
  }

  private openCircuit() {
    this.isOpen = true;
    console.warn('Circuit breaker opened');
    
    this.resetTimer = setTimeout(() => {
      this.isOpen = false;
      this.failures = 0;
      console.log('Circuit breaker closed');
    }, this.timeout);
  }
}

// Использование
const breaker = new CircuitBreaker();

try {
  const data = await breaker.call(() => 
    rabbitMQ.sendRPC('unreliable-service-queue', { action: 'getData' })
  );
} catch (error) {
  console.error('Service unavailable');
}
```

---

## Мониторинг и метрики

```typescript
class MonitoredRabbitMQService extends RabbitMQService {
  private metrics = {
    rpcCalls: 0,
    rpcSuccesses: 0,
    rpcFailures: 0,
    rpcTimeouts: 0,
    totalRPCTime: 0
  };

  async sendRPC<T>(queue: string, message: any, options?: RPCOptions): Promise<T> {
    this.metrics.rpcCalls++;
    const startTime = Date.now();

    try {
      const result = await super.sendRPC<T>(queue, message, options);
      this.metrics.rpcSuccesses++;
      this.metrics.totalRPCTime += Date.now() - startTime;
      return result;
    } catch (error) {
      if (error.message.includes('timeout')) {
        this.metrics.rpcTimeouts++;
      }
      this.metrics.rpcFailures++;
      throw error;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      avgRPCTime: this.metrics.rpcCalls > 0 
        ? this.metrics.totalRPCTime / this.metrics.rpcCalls 
        : 0,
      successRate: this.metrics.rpcCalls > 0
        ? this.metrics.rpcSuccesses / this.metrics.rpcCalls
        : 0
    };
  }
}
```

---

## Заключение

Реализация RPC паттерна позволяет:
- ✅ Синхронное взаимодействие между микросервисами
- ✅ Получение ответов от других сервисов
- ✅ Контроль таймаутов
- ✅ Надежная доставка с подтверждением
- ✅ Возможность параллельных запросов

Используйте RPC для случаев, когда нужен ответ. Для событий без ожидания ответа используйте обычный `publish()`.

