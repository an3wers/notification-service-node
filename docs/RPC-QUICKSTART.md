# RPC Quick Start Guide

Быстрое руководство по использованию RPC паттерна в RabbitMQ.

## 🚀 Быстрый старт

### 1. Инициализация

```typescript
import { RabbitMQService } from "./infrastructure/queue/rabbitmq.service";

const rabbitMQ = new RabbitMQService();
await rabbitMQ.connect();
```

При подключении автоматически создается reply queue для получения ответов.

### 2. Отправка RPC запроса (Client)

```typescript
// Простой вызов
const user = await rabbitMQ.sendRPC('user-service-queue', {
  action: 'getUser',
  userId: '123'
});

console.log(user); // { id: '123', name: 'John', ... }
```

```typescript
// С таймаутом
try {
  const result = await rabbitMQ.sendRPC(
    'service-queue',
    { action: 'getData' },
    { timeout: 5000 } // 5 секунд
  );
} catch (error) {
  console.error('Timeout or error:', error);
}
```

```typescript
// С типами TypeScript
interface UserData {
  id: string;
  name: string;
  email: string;
}

const user = await rabbitMQ.sendRPC<UserData>(
  'user-service-queue',
  { action: 'getUser', userId: '123' }
);

console.log(user.email); // TypeScript знает тип
```

### 3. Обработка RPC запроса (Server)

```typescript
await rabbitMQ.consume('user-service-queue', async (message, context) => {
  // Проверяем, это RPC запрос?
  if (context?.correlationId && context?.replyTo) {
    
    // Обрабатываем запрос
    const user = await getUserFromDB(message.userId);
    
    // Отправляем ответ
    await context.reply({
      success: true,
      data: user
    });
  } else {
    // Обычное сообщение без ответа
    console.log('Fire-and-forget message');
  }
});
```

### 4. Альтернативный способ ответа

```typescript
await rabbitMQ.consume('service-queue', async (message, context) => {
  const result = await processRequest(message);
  
  // Ручная отправка ответа
  if (context?.replyTo && context?.correlationId) {
    await rabbitMQ.sendRPCReply(
      context.replyTo,
      context.correlationId,
      result
    );
  }
});
```

## 📋 Распространенные сценарии

### Scenario 1: Получение данных пользователя

**Notification Service** (делает запрос):

```typescript
const user = await rabbitMQ.sendRPC('user-service-queue', {
  action: 'getUser',
  userId: userId
});

await sendEmail(user.email, user.name);
```

**User Service** (отвечает):

```typescript
await rabbitMQ.consume('user-service-queue', async (msg, ctx) => {
  if (msg.action === 'getUser' && ctx) {
    const user = await db.users.findById(msg.userId);
    await ctx.reply({ user });
  }
});
```

### Scenario 2: Валидация транзакции

**Payment Service**:

```typescript
// Проверяем на мошенничество
const fraudCheck = await rabbitMQ.sendRPC('fraud-detection-queue', {
  action: 'validateTransaction',
  amount: 1000,
  cardToken: 'tok_xxx'
}, { timeout: 3000 });

if (!fraudCheck.isValid) {
  throw new Error('Transaction blocked');
}

// Продолжаем обработку платежа
```

**Fraud Detection Service**:

```typescript
await rabbitMQ.consume('fraud-detection-queue', async (msg, ctx) => {
  if (msg.action === 'validateTransaction' && ctx) {
    const score = await checkFraud(msg);
    await ctx.reply({
      isValid: score > 0.8,
      score: score
    });
  }
});
```

### Scenario 3: Параллельные запросы

```typescript
// Получаем данные из трех сервисов одновременно
const [user, order, payment] = await Promise.all([
  rabbitMQ.sendRPC('user-service-queue', { action: 'getUser', id: '123' }),
  rabbitMQ.sendRPC('order-service-queue', { action: 'getOrder', id: '456' }),
  rabbitMQ.sendRPC('payment-service-queue', { action: 'getPayment', id: '789' })
]);

// Все три запроса выполняются параллельно
console.log(user, order, payment);
```

## ⚠️ Обработка ошибок

### Timeout

```typescript
try {
  const result = await rabbitMQ.sendRPC('service-queue', data, {
    timeout: 5000
  });
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('Service не ответил вовремя');
    // Используем fallback значение
  }
}
```

### Circuit Breaker Pattern

```typescript
async function callWithFallback<T>(
  rabbitMQ: RabbitMQService,
  queue: string,
  message: any,
  fallback: T
): Promise<T> {
  try {
    return await rabbitMQ.sendRPC<T>(queue, message, { timeout: 5000 });
  } catch (error) {
    console.warn('RPC failed, using fallback');
    return fallback;
  }
}

// Использование
const user = await callWithFallback(
  rabbitMQ,
  'user-service-queue',
  { action: 'getUser', userId: '123' },
  { id: '123', name: 'Unknown', email: 'unknown@example.com' }
);
```

### Retry Logic

```typescript
async function rpcWithRetry<T>(
  rabbitMQ: RabbitMQService,
  queue: string,
  message: any,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await rabbitMQ.sendRPC<T>(queue, message, { timeout: 5000 });
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      console.log(`Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error('All retries failed');
}
```

## 🎯 Best Practices

### ✅ DO

```typescript
// 1. Используйте разумные таймауты
await rabbitMQ.sendRPC(queue, data, { timeout: 5000 }); // 5 секунд

// 2. Обрабатывайте ошибки
try {
  await rabbitMQ.sendRPC(queue, data);
} catch (error) {
  // handle error
}

// 3. Используйте типы TypeScript
interface Response { success: boolean; data: any }
const result = await rabbitMQ.sendRPC<Response>(queue, data);

// 4. Логируйте correlationId для debugging
await rabbitMQ.consume('queue', async (msg, ctx) => {
  console.log(`Processing request ${ctx?.correlationId}`);
});

// 5. Параллельные запросы где возможно
const results = await Promise.all([
  rabbitMQ.sendRPC(...),
  rabbitMQ.sendRPC(...),
]);
```

### ❌ DON'T

```typescript
// 1. Не делайте слишком большие таймауты
await rabbitMQ.sendRPC(queue, data, { timeout: 300000 }); // ❌ 5 минут

// 2. Не игнорируйте ошибки
await rabbitMQ.sendRPC(queue, data); // ❌ нет try-catch

// 3. Не создавайте RPC цепочки
// Service A -> RPC -> Service B -> RPC -> Service C -> RPC -> Service D
// ❌ Слишком сложно, используйте event-driven подход

// 4. Не используйте RPC для длительных операций
await rabbitMQ.sendRPC('video-processing-queue', videoData); // ❌
// Лучше: publish + consume с callback

// 5. Не забывайте проверять context
await rabbitMQ.consume('queue', async (msg, ctx) => {
  await ctx.reply(data); // ❌ ctx может быть undefined
  
  // ✅ Правильно:
  if (ctx?.replyTo) {
    await ctx.reply(data);
  }
});
```

## 🔧 Конфигурация

### Таймауты

```typescript
// По умолчанию: 30 секунд
await rabbitMQ.sendRPC(queue, data);

// Кастомный таймаут
await rabbitMQ.sendRPC(queue, data, { timeout: 5000 }); // 5 секунд

// Для разных типов операций
const TIMEOUTS = {
  FAST: 2000,      // быстрые операции (ping, cache lookup)
  NORMAL: 5000,    // обычные операции (DB query)
  SLOW: 30000,     // медленные операции (external API)
};

await rabbitMQ.sendRPC(queue, data, { timeout: TIMEOUTS.FAST });
```

### Correlation ID

```typescript
// Автоматический (рекомендуется)
await rabbitMQ.sendRPC(queue, data);

// Ручной (для трейсинга)
const traceId = generateTraceId();
await rabbitMQ.sendRPC(queue, data, { correlationId: traceId });
```

## 📊 Мониторинг

```typescript
// Простое логирование
await rabbitMQ.consume('queue', async (msg, ctx) => {
  const startTime = Date.now();
  
  const result = await processRequest(msg);
  
  const duration = Date.now() - startTime;
  console.log(`Request ${ctx?.correlationId} took ${duration}ms`);
  
  await ctx?.reply(result);
});

// Метрики
let rpcCount = 0;
let rpcErrors = 0;
let totalDuration = 0;

const originalSendRPC = rabbitMQ.sendRPC.bind(rabbitMQ);
rabbitMQ.sendRPC = async function<T>(...args: any[]): Promise<T> {
  rpcCount++;
  const start = Date.now();
  
  try {
    const result = await originalSendRPC(...args);
    totalDuration += Date.now() - start;
    return result;
  } catch (error) {
    rpcErrors++;
    throw error;
  }
};

// Показываем метрики каждую минуту
setInterval(() => {
  console.log({
    rpcCount,
    rpcErrors,
    avgDuration: rpcCount > 0 ? totalDuration / rpcCount : 0,
    errorRate: rpcCount > 0 ? rpcErrors / rpcCount : 0
  });
}, 60000);
```

## 🧪 Тестирование

```typescript
// Mock для тестов
class MockRabbitMQService {
  async sendRPC<T>(queue: string, message: any): Promise<T> {
    // Возвращаем мок данные
    if (queue === 'user-service-queue') {
      return { id: '123', name: 'Test User' } as T;
    }
    throw new Error('Unknown queue');
  }
}

// Использование в тестах
describe('NotificationService', () => {
  it('should send notification', async () => {
    const mockRabbitMQ = new MockRabbitMQService();
    const service = new NotificationService(mockRabbitMQ);
    
    await service.sendNotification('123');
    // assertions...
  });
});
```

## 📚 Дополнительная документация

- [Подробные примеры](./rabbitmq-rpc-examples.md)
- [Архитектура решения](./rabbitmq-rpc-architecture.md)
- [Changelog](./CHANGELOG-RPC.md)

## 🆘 Troubleshooting

### Проблема: Timeout errors

**Решение:**
- Увеличьте timeout: `{ timeout: 10000 }`
- Проверьте, работает ли целевой сервис
- Добавьте retry logic

### Проблема: "RabbitMQ not properly initialized for RPC"

**Решение:**
- Убедитесь, что вызван `await rabbitMQ.connect()` перед `sendRPC()`
- Проверьте, что соединение не закрыто

### Проблема: Ответы не приходят

**Решение:**
- Проверьте, что в consumer вы вызываете `context.reply()`
- Убедитесь, что correlationId передается корректно
- Проверьте логи RabbitMQ

### Проблема: Memory leak

**Решение:**
- Проверьте, что вы правильно обрабатываете ошибки
- Таймауты должны быть разумными
- При shutdown вызывайте `await rabbitMQ.close()`

---

**Готово!** Теперь вы можете использовать RPC паттерн для синхронной коммуникации между микросервисами. 🚀

