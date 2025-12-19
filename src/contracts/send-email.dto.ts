import { z } from "zod";

const emailOrEmailsString = z.union([
  z.email(),
  z.array(z.email()),
  z.string().refine(
    (val) => {
      const emails = val
        .split(";")
        .map((e) => e.trim())
        .filter(Boolean);
      return (
        emails.length > 0 &&
        emails.every((email) => z.email().safeParse(email).success)
      );
    },
    {
      message: "String must contain valid email addresses separated by ';'",
    },
  ),
]);

export const SendEmailDtoSchema = z.object({
  to: emailOrEmailsString,
  fromDisplayName: z.string().optional(),

  // fromEmail and from are the same
  fromEmail: z.email().optional(),
  from: z.email().optional(),

  // subject and title are the same
  subject: z.string().min(1).optional(),
  title: z.string().min(1).optional(),

  // body and message are the same
  body: z.string().min(1).optional(),
  message: z.string().min(1).optional(),

  html: z.string().optional(),

  cc: emailOrEmailsString.optional(),
  bcc: emailOrEmailsString.optional(),
});

export type SendEmailDto = z.infer<typeof SendEmailDtoSchema>;
