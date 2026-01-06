# Архитектура RPC паттерна в RabbitMQ

## Как это работает

### 1. Инициализация Reply Queue

При подключении к RabbitMQ автоматически создается эксклюзивная временная очередь для получения ответов:

```
┌─────────────────────────┐
│  RabbitMQService        │
│  .connect()             │
└───────────┬─────────────┘
            │
            ├─► Создает основные очереди и exchange
            │
            └─► initializeReplyQueue()
                 │
                 ├─► assertQueue("", { exclusive: true })
                 │   Создает временную очередь: amq.gen-XYZ123
                 │
                 └─► Начинает слушать ответы в этой очереди
```

### 2. RPC Request Flow (Запрос)

```
Service A                    RabbitMQ                    Service B
   │                            │                            │
   │ sendRPC()                  │                            │
   ├──────────────────────────► │                            │
   │ properties: {              │                            │
   │   replyTo: "amq.gen-XYZ"   │  publish to               │
   │   correlationId: "uuid"    │  service-b-queue          │
   │ }                          ├──────────────────────────► │
   │                            │                            │
   │ Сохраняет Promise          │                            │ consume()
   │ в pendingRPCRequests       │                            │ получает сообщение
   │                            │                            │
   │ Устанавливает timeout      │                            │ обрабатывает
   │                            │                            │
   │                            │                            │ context.reply()
   │                            │  sendRPCReply()            │
   │                            │ ◄────────────────────────── │
   │ handleRPCReply()           │                            │
   │ ◄────────────────────────── │                            │
   │ properties: {              │                            │
   │   correlationId: "uuid"    │                            │
   │ }                          │                            │
   │                            │                            │
   │ resolve(response)          │                            │
   │                            │                            │
```

### 3. Структура классов и методов

```
┌──────────────────────────────────────────────────────┐
│             RabbitMQService                          │
├──────────────────────────────────────────────────────┤
│  Fields:                                             │
│  - connection: ChannelModel                          │
│  - channel: Channel                                  │
│  - replyQueue: string                                │
│  - pendingRPCRequests: Map<string, Promise>          │
├──────────────────────────────────────────────────────┤
│  Public Methods:                                     │
│  + connect(): Promise<void>                          │
│  + publish(queue, message, options?): Promise<void>  │
│  + sendRPC<T>(queue, message, options?): Promise<T>  │
│  + consume(queue, handler): Promise<void>            │
│  + close(): Promise<void>                            │
├──────────────────────────────────────────────────────┤
│  Private Methods:                                    │
│  - initializeReplyQueue(): Promise<void>             │
│  - handleRPCReply(msg): void                         │
│  - sendRPCReply(replyTo, correlationId, resp)        │
└──────────────────────────────────────────────────────┘
```

### 4. Correlation ID Mapping

```
pendingRPCRequests Map:
┌──────────────────────────────────────────────────────┐
│ correlationId         │  Promise + Timeout           │
├──────────────────────────────────────────────────────┤
│ "550e8400-e29b..."    │  { resolve, reject, timer }  │
│ "6ba7b810-9dad..."    │  { resolve, reject, timer }  │
│ "7c9e6679-7425..."    │  { resolve, reject, timer }  │
└──────────────────────────────────────────────────────┘

Когда приходит ответ:
1. Извлекаем correlationId из properties
2. Находим соответствующий Promise в Map
3. Вызываем resolve() или reject()
4. Удаляем из Map
```

### 5. Timeout механизм

```
sendRPC() вызов:
    │
    ├─► Создает Promise
    │
    ├─► Устанавливает setTimeout(timeout)
    │        │
    │        └─► Если истекает время:
    │             - удаляет из pendingRPCRequests
    │             - вызывает reject("timeout")
    │
    ├─► Отправляет сообщение
    │
    └─► Возвращает Promise

Если ответ приходит вовремя:
    - clearTimeout()
    - resolve(data)
```

### 6. MessageContext в consumer

```typescript
MessageContext интерфейс предоставляет:

┌──────────────────────────────────────┐
│  MessageContext                      │
├──────────────────────────────────────┤
│  replyTo?: string                    │  ◄─── Куда отправить ответ
│  correlationId?: string              │  ◄─── ID для связи запроса/ответа
│  timestamp?: number                  │  ◄─── Время отправки
│  reply: (response) => Promise<void>  │  ◄─── Хелпер для отправки ответа
└──────────────────────────────────────┘

Обработчик может проверить:
if (context?.correlationId && context?.replyTo) {
  // Это RPC запрос, нужно ответить
  await context.reply(result);
} else {
  // Обычное сообщение (fire-and-forget)
}
```

### 7. Сценарии использования

#### Сценарий 1: Request-Reply (RPC)

```
Notification Service          User Service
       │                           │
       │ Нужны данные пользователя │
       ├──────────sendRPC()────────►│
       │                            │
       │   ◄────ждет ответ────      │
       │                            │
       │◄──────reply(userData)──────┤
       │                            │
       └─► Отправляет уведомление
```

#### Сценарий 2: Fire-and-Forget

```
Order Service            Notification Service
      │                          │
      │ Заказ создан             │
      ├──────publish()──────────►│
      │                          │
      │ (не ждет ответа)         │
      └─► Продолжает работу      │
                                 │
                        consume() получает
                        Отправляет email
```

#### Сценарий 3: Множественные RPC

```
API Gateway              
      │                          
      ├─────sendRPC()──────► User Service
      │                          │
      ├─────sendRPC()──────► Order Service
      │                          │
      ├─────sendRPC()──────► Payment Service
      │                          │
      │                          │
      │◄────все ответы получены──┤
      │                          
      └─► Агрегирует и возвращает клиенту
```

### 8. Обработка ошибок

```
┌─────────────────────────────────────────────┐
│  Возможные ошибки RPC                       │
├─────────────────────────────────────────────┤
│  1. Timeout                                 │
│     - Service не ответил вовремя            │
│     - reject("RPC timeout after Xms")       │
│                                             │
│  2. Connection closed                       │
│     - RabbitMQ соединение разорвано         │
│     - Все pending запросы отклоняются       │
│                                             │
│  3. Parse error                             │
│     - Невалидный JSON в ответе              │
│     - reject("Failed to parse RPC reply")   │
│                                             │
│  4. Service error                           │
│     - Service вернул ошибку в ответе        │
│     - resolve({ success: false, error })    │
└─────────────────────────────────────────────┘
```

### 9. Graceful Shutdown

```
process.on('SIGINT/SIGTERM')
         │
         ├─► rabbitMQ.close()
         │        │
         │        ├─► Для каждого pending RPC:
         │        │    - clearTimeout()
         │        │    - reject("connection closed")
         │        │
         │        ├─► pendingRPCRequests.clear()
         │        │
         │        ├─► channel.close()
         │        │
         │        └─► connection.close()
         │
         └─► process.exit(0)
```

### 10. Преимущества и недостатки

#### Преимущества RPC паттерна

✅ **Синхронная коммуникация** - получаете ответ  
✅ **Timeout контроль** - не ждете вечно  
✅ **Типобезопасность** - TypeScript generics  
✅ **Correlation tracking** - легко отследить запросы  
✅ **Параллелизм** - множественные RPC вызовы одновременно  

#### Недостатки

❌ **Tight coupling** - сервисы зависят друг от друга  
❌ **Cascading failures** - если Service B упал, Service A тоже страдает  
❌ **Latency** - накладывается время ожидания  
❌ **Сложность** - больше кода и логики  

#### Когда использовать RPC

✅ Нужны данные от другого сервиса для продолжения работы  
✅ Валидация/авторизация через другой сервис  
✅ Синхронные операции (платежи, бронирования)  

#### Когда НЕ использовать RPC

❌ События которые можно обработать асинхронно  
❌ Уведомления (fire-and-forget)  
❌ Логирование, аналитика  
❌ Длительные операции (> 30 секунд)  

### 11. Альтернативы RPC

```
┌──────────────────────────────────────────────────────┐
│  Паттерн              │  Когда использовать           │
├──────────────────────────────────────────────────────┤
│  RPC                  │  Нужен синхронный ответ       │
│  Pub/Sub              │  События для многих слушателей│
│  Event Sourcing       │  История всех изменений       │
│  CQRS                 │  Разделение чтения/записи     │
│  Saga Pattern         │  Распределенные транзакции    │
│  HTTP REST            │  Прямое взаимодействие        │
│  gRPC                 │  Высокая производительность   │
└──────────────────────────────────────────────────────┘
```

### 12. Производительность

```
Метрики RPC вызова:
┌──────────────────────────────────────────┐
│  Фаза              │  Примерное время    │
├──────────────────────────────────────────┤
│  Сериализация      │  < 1ms              │
│  Отправка          │  1-5ms              │
│  Обработка         │  10-100ms           │
│  Ответ             │  1-5ms              │
│  Десериализация    │  < 1ms              │
├──────────────────────────────────────────┤
│  ИТОГО             │  ~15-115ms          │
└──────────────────────────────────────────┘

Рекомендации:
- Timeout: 5-30 секунд для большинства случаев
- Кэшируйте данные которые редко меняются
- Используйте параллельные запросы где возможно
- Мониторьте метрики RPC вызовов
```

---

## Заключение

RPC паттерн через RabbitMQ обеспечивает:
- Надежную синхронную коммуникацию между микросервисами
- Контроль таймаутов и обработку ошибок
- Correlation tracking для debugging
- Graceful degradation при недоступности сервисов

Используйте с умом и не злоупотребляйте синхронными вызовами там, где можно обойтись асинхронными событиями.

