import { z } from "zod";

export const SendEmailDtoSchema = z.object({
  to: z.union([z.email(), z.array(z.email())]), // получатели письма
  displayName: z.string().optional(), // имя отправителя
  subject: z.string().min(1), // тема письма
  body: z.string().min(1), // текст письма
  html: z.string().optional(), // html текст письма
  cc: z.union([z.email(), z.array(z.email())]).optional(), // копии письма
  bcc: z.union([z.email(), z.array(z.email())]).optional(), // скрытые копии письма
});

export type SendEmailDto = z.infer<typeof SendEmailDtoSchema>;

export function normalizeSendEmailDto(dto: SendEmailDto): {
  to: string[];
  displayName?: string;
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  html?: string;
} {
  return {
    to: Array.isArray(dto.to) ? dto.to : [dto.to],
    displayName: dto.displayName,
    cc: dto.cc ? (Array.isArray(dto.cc) ? dto.cc : [dto.cc]) : [],
    bcc: dto.bcc ? (Array.isArray(dto.bcc) ? dto.bcc : [dto.bcc]) : [],
    subject: dto.subject,
    body: dto.body,
    html: dto.html,
  };
}
