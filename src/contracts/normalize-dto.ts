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

  const ccValue = [];
  if (Array.isArray(dto.cc)) {
    ccValue.push(...dto.cc);
  } else if (typeof dto.cc === "string") {
    const splited = dto.cc.split(";");
    ccValue.push(...splited);
  }

  const bccValue = [];
  if (Array.isArray(dto.bcc)) {
    bccValue.push(...dto.bcc);
  } else if (typeof dto.bcc === "string") {
    const splited = dto.bcc.split(";");
    bccValue.push(...splited);
  }

  return {
    to: toValue,
    displayName: dto.fromDisplayName,
    from: dto.fromEmail,
    cc: ccValue,
    bcc: bccValue,

    subject: dto.subject ?? dto.title ?? "",
    body: dto.body ?? dto.message ?? "",

    html: dto.html,
  };
}
