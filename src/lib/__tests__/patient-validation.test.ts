import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  isValidFrenchPhone,
  validateEmail,
  validatePhone,
  validatePatientData,
} from "../patient-validation";

describe("isValidEmail", () => {
  describe("valid emails", () => {
    it.each([
      "user@example.com",
      "jean.dupont@example.fr",
      "first.last@sub.domain.com",
      "user+tag@example.com",
      "user@example.co.uk",
      "name@domain.org",
      "a@b.cd",
      "user_name@domain.com",
      "user-name@domain.com",
    ])("should accept %s", (email) => {
      expect(isValidEmail(email)).toBe(true);
    });

    it("should accept email with leading/trailing whitespace (trimmed)", () => {
      expect(isValidEmail("  user@example.com  ")).toBe(true);
    });
  });

  describe("invalid emails", () => {
    it.each([
      "not-an-email",
      "@example.com",
      "user@",
      "user@.com",
      "user@com",
      "",
      "user @example.com",
      "user@exam ple.com",
      "user@example",
      "user@@example.com",
    ])("should reject %s", (email) => {
      expect(isValidEmail(email)).toBe(false);
    });

    it("should reject non-string input", () => {
      expect(isValidEmail(null as unknown as string)).toBe(false);
      expect(isValidEmail(undefined as unknown as string)).toBe(false);
      expect(isValidEmail(123 as unknown as string)).toBe(false);
    });
  });
});

describe("isValidFrenchPhone", () => {
  describe("valid national format (0X XX XX XX XX)", () => {
    it.each([
      ["01 23 45 67 89", "landline Paris"],
      ["02 23 45 67 89", "landline Northwest"],
      ["03 23 45 67 89", "landline Northeast"],
      ["04 23 45 67 89", "landline Southeast"],
      ["05 23 45 67 89", "landline Southwest"],
      ["06 12 34 56 78", "mobile"],
      ["07 12 34 56 78", "mobile"],
      ["08 00 11 22 33", "special/premium"],
      ["09 12 34 56 78", "VoIP"],
    ])("should accept %s (%s)", (phone) => {
      expect(isValidFrenchPhone(phone)).toBe(true);
    });
  });

  describe("valid compact format (0XXXXXXXXX)", () => {
    it.each([
      "0123456789",
      "0612345678",
      "0712345678",
      "0800112233",
    ])("should accept %s", (phone) => {
      expect(isValidFrenchPhone(phone)).toBe(true);
    });
  });

  describe("valid with dots separator", () => {
    it.each([
      "01.23.45.67.89",
      "06.12.34.56.78",
    ])("should accept %s", (phone) => {
      expect(isValidFrenchPhone(phone)).toBe(true);
    });
  });

  describe("valid with hyphens separator", () => {
    it.each([
      "01-23-45-67-89",
      "06-12-34-56-78",
    ])("should accept %s", (phone) => {
      expect(isValidFrenchPhone(phone)).toBe(true);
    });
  });

  describe("valid international format (+33)", () => {
    it.each([
      "+33612345678",
      "+33 6 12 34 56 78",
      "+33123456789",
      "+33 1 23 45 67 89",
    ])("should accept %s", (phone) => {
      expect(isValidFrenchPhone(phone)).toBe(true);
    });
  });

  describe("valid international format (0033)", () => {
    it.each([
      "0033612345678",
      "0033 6 12 34 56 78",
      "0033123456789",
    ])("should accept %s", (phone) => {
      expect(isValidFrenchPhone(phone)).toBe(true);
    });
  });

  describe("valid with whitespace trimming", () => {
    it("should accept phone with leading/trailing whitespace", () => {
      expect(isValidFrenchPhone("  06 12 34 56 78  ")).toBe(true);
    });
  });

  describe("invalid phone numbers", () => {
    it.each([
      ["", "empty string"],
      ["12345", "too short"],
      ["00 12 34 56 78", "starts with 00 (not international prefix)"],
      ["+44 7911 123456", "UK number"],
      ["+1 555 123 4567", "US number"],
      ["0612345", "too few digits"],
      ["061234567890", "too many digits"],
      ["+3361234567", "international with too few digits"],
      ["abcdefghij", "non-numeric"],
    ])("should reject %s (%s)", (phone) => {
      expect(isValidFrenchPhone(phone)).toBe(false);
    });

    it("should reject non-string input", () => {
      expect(isValidFrenchPhone(null as unknown as string)).toBe(false);
      expect(isValidFrenchPhone(undefined as unknown as string)).toBe(false);
      expect(isValidFrenchPhone(123 as unknown as string)).toBe(false);
    });
  });
});

describe("validateEmail", () => {
  it("should return null for valid email", () => {
    expect(validateEmail("jean@example.fr")).toBeNull();
  });

  it("should return error for missing email", () => {
    const error = validateEmail(undefined);
    expect(error).not.toBeNull();
    expect(error!.field).toBe("email");
    expect(error!.message).toContain("requise");
  });

  it("should return error for empty email", () => {
    const error = validateEmail("");
    expect(error).not.toBeNull();
    expect(error!.field).toBe("email");
  });

  it("should return conversational error for invalid email", () => {
    const error = validateEmail("not-valid");
    expect(error).not.toBeNull();
    expect(error!.field).toBe("email");
    expect(error!.message).toContain("invalide");
    expect(error!.message).toContain("repeter");
  });
});

describe("validatePhone", () => {
  it("should return null for valid French phone", () => {
    expect(validatePhone("06 12 34 56 78")).toBeNull();
  });

  it("should return null for undefined phone (optional)", () => {
    expect(validatePhone(undefined)).toBeNull();
  });

  it("should return null for empty string phone (treated as not provided)", () => {
    expect(validatePhone("")).toBeNull();
  });

  it("should return conversational error for invalid phone", () => {
    const error = validatePhone("+1 555 123 4567");
    expect(error).not.toBeNull();
    expect(error!.field).toBe("phone");
    expect(error!.message).toContain("invalide");
    expect(error!.message).toContain("repeter");
    expect(error!.message).toContain("francais");
  });

  it("should return error for non-string phone", () => {
    const error = validatePhone(123 as unknown as string);
    expect(error).not.toBeNull();
    expect(error!.field).toBe("phone");
  });
});

describe("validatePatientData", () => {
  it("should return valid for correct email and phone", () => {
    const result = validatePatientData({
      email: "jean@example.fr",
      phone: "06 12 34 56 78",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should return valid for correct email without phone", () => {
    const result = validatePatientData({
      email: "jean@example.fr",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should return errors for invalid email and phone", () => {
    const result = validatePatientData({
      email: "invalid",
      phone: "123",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((e) => e.field)).toContain("email");
    expect(result.errors.map((e) => e.field)).toContain("phone");
  });

  it("should return error only for invalid email when phone is valid", () => {
    const result = validatePatientData({
      email: "bad",
      phone: "0612345678",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe("email");
  });

  it("should return error only for invalid phone when email is valid", () => {
    const result = validatePatientData({
      email: "jean@example.fr",
      phone: "123",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe("phone");
  });
});
