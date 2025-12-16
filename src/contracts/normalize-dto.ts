import type { SendEmailDto } from "./send-email.dto.ts";

export function normalizeSendEmailDto(dto: SendEmailDto): {
  to: string[];
  from?: string;
  displayName?: string;
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

  return {
    to: toValue,
    displayName: dto.fromDisplayName,
    from: dto.fromEmail,
    cc: dto.cc ? (Array.isArray(dto.cc) ? dto.cc : [dto.cc]) : [],
    bcc: dto.bcc ? (Array.isArray(dto.bcc) ? dto.bcc : [dto.bcc]) : [],

    subject: dto.subject ?? dto.title ?? "",
    body: dto.body ?? dto.message ?? "",

    html: dto.html,
  };
}
