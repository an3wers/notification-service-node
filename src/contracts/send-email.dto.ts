import { z } from "zod";

export const SendEmailDtoSchema = z.object({
  to: z.union([z.email(), z.array(z.email())]),
  fromDisplayName: z.string().optional(),
  fromEmail: z.email().optional(),

  // subject and title are the same
  subject: z.string().min(1).optional(),
  title: z.string().min(1).optional(),

  // body and message are the same
  body: z.string().min(1).optional(),
  message: z.string().min(1).optional(),

  html: z.string().optional(),
  cc: z.union([z.email(), z.array(z.email())]).optional(),
  bcc: z.union([z.email(), z.array(z.email())]).optional(),
});

export type SendEmailDto = z.infer<typeof SendEmailDtoSchema>;
