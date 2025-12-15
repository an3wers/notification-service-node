import { z } from "zod";

export const SendEmailDtoSchema = z.object({
  to: z.union([z.email(), z.array(z.email())]),
  displayName: z.string().optional(),
  from: z.string().optional(),
  fromDisplayName: z.string().optional(),
  fromEmail: z.email().optional(),
  subject: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  html: z.string().optional(),
  cc: z.union([z.email(), z.array(z.email())]).optional(),
  bcc: z.union([z.email(), z.array(z.email())]).optional(),
});

export type SendEmailDto = z.infer<typeof SendEmailDtoSchema>;

export function normalizeSendEmailDto(dto: SendEmailDto): {
  to: string[];
  from?: string;
  displayName?: string;
  fromEmail?: string;
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  html?: string;
} {
  const toValue = [];

  if (Array.isArray(dto.to)) {
    toValue.push(...dto.to);
  } else if (typeof dto.to === "string") {
    const splited = dto.to.split(";");
    toValue.push(...splited);
  }

  let displayNameValue: string | undefined;

  if ("displayName" in dto) {
    displayNameValue = dto.displayName;
  } else if ("fromDisplayName" in dto) {
    displayNameValue = dto.fromDisplayName;
  }

  return {
    to: toValue,
    from: dto.from,
    displayName: displayNameValue,
    fromEmail: dto.fromEmail,
    cc: dto.cc ? (Array.isArray(dto.cc) ? dto.cc : [dto.cc]) : [],
    bcc: dto.bcc ? (Array.isArray(dto.bcc) ? dto.bcc : [dto.bcc]) : [],
    subject: dto.subject || dto.title || "",
    body: dto.body || dto.message || "",
    html: dto.html,
  };
}
