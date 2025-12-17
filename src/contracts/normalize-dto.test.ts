import { describe, it, expect } from "vitest";
import { normalizeSendEmailDto } from "./normalize-dto.ts";
import type { SendEmailDto } from "./send-email.dto.ts";

describe("to field normalization", () => {
  it("should handle single email string", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.to).toEqual(["test@example.com"]);
  });

  it("should split string with semicolon separator", () => {
    const dto: SendEmailDto = {
      to: "test1@example.com;test2@example.com;test3@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.to).toEqual([
      "test1@example.com",
      "test2@example.com",
      "test3@example.com",
    ]);
  });

  it("should handle array of emails", () => {
    const dto: SendEmailDto = {
      to: ["test1@example.com", "test2@example.com"],
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.to).toEqual(["test1@example.com", "test2@example.com"]);
  });
});

describe("cc field normalization", () => {
  it("should handle single cc email string", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      cc: "cc@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.cc).toEqual(["cc@example.com"]);
  });

  it("should split cc string with semicolon separator", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      cc: "cc1@example.com;cc2@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.cc).toEqual(["cc1@example.com", "cc2@example.com"]);
  });

  it("should handle array of cc emails", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      cc: ["cc1@example.com", "cc2@example.com"],
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.cc).toEqual(["cc1@example.com", "cc2@example.com"]);
  });

  it("should return empty array when cc is not provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.cc).toEqual([]);
  });
});

describe("bcc field normalization", () => {
  it("should handle single bcc email string", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      bcc: "bcc@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.bcc).toEqual(["bcc@example.com"]);
  });

  it("should split bcc string with semicolon separator", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      bcc: "bcc1@example.com;bcc2@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.bcc).toEqual(["bcc1@example.com", "bcc2@example.com"]);
  });

  it("should handle array of bcc emails", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      bcc: ["bcc1@example.com", "bcc2@example.com"],
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.bcc).toEqual(["bcc1@example.com", "bcc2@example.com"]);
  });

  it("should return empty array when bcc is not provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.bcc).toEqual([]);
  });
});

describe("from field mapping", () => {
  it("should map fromEmail to from", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      fromEmail: "sender@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.from).toBe("sender@example.com");
  });

  it("should map fromDisplayName to displayName", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      fromDisplayName: "John Doe",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.displayName).toBe("John Doe");
  });

  it("should handle both fromEmail and fromDisplayName", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      fromEmail: "sender@example.com",
      fromDisplayName: "John Doe",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.from).toBe("sender@example.com");
    expect(result.displayName).toBe("John Doe");
  });

  it("should handle undefined fromEmail and fromDisplayName", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.from).toBeUndefined();
    expect(result.displayName).toBeUndefined();
  });
});

describe("subject and title field mapping", () => {
  it("should use subject when provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test Subject",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.subject).toBe("Test Subject");
  });

  it("should fallback to title when subject is not provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      title: "Test Title",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.subject).toBe("Test Title");
  });

  it("should prefer subject over title when both are provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test Subject",
      title: "Test Title",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.subject).toBe("Test Subject");
  });

  it("should return empty string when neither subject nor title is provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.subject).toBe("");
  });
});

describe("body and message field mapping", () => {
  it("should use body when provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test",
      body: "Test Body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.body).toBe("Test Body");
  });

  it("should fallback to message when body is not provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test",
      message: "Test Message",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.body).toBe("Test Message");
  });

  it("should prefer body over message when both are provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test",
      body: "Test Body",
      message: "Test Message",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.body).toBe("Test Body");
  });

  it("should return empty string when neither body nor message is provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.body).toBe("");
  });
});

describe("html field", () => {
  it("should pass through html field when provided", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
      html: "<h1>Test HTML</h1>",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.html).toBe("<h1>Test HTML</h1>");
  });

  it("should handle undefined html field", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.html).toBeUndefined();
  });
});

describe("complex scenarios", () => {
  it("should handle complete email with all fields", () => {
    const dto: SendEmailDto = {
      to: "recipient1@example.com;recipient2@example.com",
      cc: ["cc1@example.com", "cc2@example.com"],
      bcc: "bcc@example.com",
      fromEmail: "sender@example.com",
      fromDisplayName: "John Doe",
      subject: "Test Subject",
      body: "Test Body",
      html: "<p>Test HTML</p>",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result).toEqual({
      to: ["recipient1@example.com", "recipient2@example.com"],
      cc: ["cc1@example.com", "cc2@example.com"],
      bcc: ["bcc@example.com"],
      from: "sender@example.com",
      displayName: "John Doe",
      subject: "Test Subject",
      body: "Test Body",
      html: "<p>Test HTML</p>",
    });
  });

  it("should handle minimal email with only required fields", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result).toEqual({
      to: ["test@example.com"],
      cc: [],
      bcc: [],
      subject: "",
      body: "",
      from: undefined,
      displayName: undefined,
      html: undefined,
    });
  });

  it("should handle email with title and message instead of subject and body", () => {
    const dto: SendEmailDto = {
      to: "test@example.com",
      title: "Test Title",
      message: "Test Message",
    };

    const result = normalizeSendEmailDto(dto);
    expect(result.subject).toBe("Test Title");
    expect(result.body).toBe("Test Message");
  });
});
