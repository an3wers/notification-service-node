# Notification Service - Архитектура и Структура

## Структура монорепозитория

```
project-root/
├── pnpm-workspace.yaml
├── package.json
│   ├── email/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── index.ts
│   │       ├── app.ts
│   │       ├── config/
│   │       │   ├── index.ts
│   │       │   └── multer.config.ts
│   │       ├── domain/
│   │       │   ├── entities/
│   │       │   │   ├── Email.ts
│   │       │   │   └── Attachment.ts
│   │       │   ├── interfaces/
│   │       │   │   ├── IEmailRepository.ts
│   │       │   │   ├── IEmailProvider.ts
│   │       │   │   └── IQueueService.ts
│   │       │   └── value-objects/
│   │       │       └── EmailAddress.ts
│   │       ├── application/
│   │       │   ├── use-cases/
│   │       │   │   ├── SendEmailUseCase.ts
│   │       │   │   └── GetEmailStatusUseCase.ts
│   │       │   └── dto/
│   │       │       ├── SendEmailDto.ts
│   │       │       └── EmailResponseDto.ts
│   │       ├── infrastructure/
│   │       │   ├── email/
│   │       │   │   └── NodemailerProvider.ts
│   │       │   ├── queue/
│   │       │   │   ├── RabbitMQService.ts
│   │       │   │   └── EmailConsumer.ts
│   │       │   └── storage/
│   │       │       └── FileStorage.ts
│   │       └── presentation/
│   │           ├── http/
│   │           │   ├── controllers/
│   │           │   │   └── EmailController.ts
│   │           │   ├── routes/
│   │           │   │   └── email.routes.ts
│   │           │   └── middlewares/
│   │           │       ├── errorHandler.ts
│   │           │       └── validation.ts
│   │           └── queue/
│   │               └── EmailQueueController.ts
│   └── shared/
│       └── package.json
└── README.md
```

## Слои архитектуры

### 1. Domain Layer (Доменный слой)

- **Entities**: Бизнес-сущности (Email, Attachment)
- **Value Objects**: Объекты-значения (EmailAddress)
- **Interfaces**: Контракты для инфраструктурных компонентов

### 2. Application Layer (Слой приложения)

- **Use Cases**: Бизнес-логика (SendEmailUseCase, GetEmailStatusUseCase)
- **DTOs**: Объекты передачи данных

### 3. Infrastructure Layer (Инфраструктурный слой)

- **Persistence**: Prisma-репозитории
- **Email Provider**: Nodemailer
- **Queue**: RabbitMQ
- **Storage**: Хранилище файлов

### 4. Presentation Layer (Слой представления)

- **HTTP Controllers**: REST API контроллеры
- **Queue Controllers**: Обработчики очереди
- **Routes**: Маршрутизация
- **Middlewares**: Промежуточные обработчики

## Технологический стек

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Message Queue**: RabbitMQ (amqplib)
- **Email**: Nodemailer
- **File Upload**: Multer
- **Validation**: Zod
- **Package Manager**: pnpm

## Основные компоненты

### HTTP API

- `POST /api/emails` - Отправка email (multipart/form-data)
- `GET /api/emails/:id` - Получение статуса отправки

### RabbitMQ Queue

- Queue: `email.send`
- Exchange: `email.exchange`
- Routing Key: `email.send`

## Переменные окружения

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/emaildb"

# RabbitMQ
RABBITMQ_URL="amqp://localhost:5672"
RABBITMQ_QUEUE="email.send"

# Email Provider
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourapp.com

# Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

## Prisma Schema

Схема включает:

- Таблица `Email` - хранение информации об отправленных письмах
- Таблица `Attachment` - вложения
- Enum `EmailStatus` - статусы отправки

## API Примеры

### Отправка email через HTTP

```bash
curl -X POST http://localhost:3001/api/emails \
  -F "to=recipient@example.com" \
  -F "subject=Test Email" \
  -F "body=Hello World" \
  -F "files=@document.pdf" \
  -F "files=@image.jpg"
```

### Отправка email через RabbitMQ

```json
{
  "to": ["recipient@example.com"],
  "subject": "Test Email",
  "body": "Hello from queue",
  "html": "<h1>Hello</h1>",
  "cc": ["cc@example.com"],
  "bcc": ["bcc@example.com"]
}
```

## Преимущества архитектуры

1. **Разделение ответственности**: Каждый слой имеет чёткую задачу
2. **Тестируемость**: Легко писать unit и integration тесты
3. **Масштабируемость**: Простое добавление новых провайдеров
4. **Независимость**: Бизнес-логика не зависит от инфраструктуры
5. **SOLID принципы**: Соблюдение всех принципов ООП
