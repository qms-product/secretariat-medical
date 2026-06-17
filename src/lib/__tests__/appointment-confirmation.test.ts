import { describe, it, expect } from "vitest";
import {
  formatDateFr,
  formatTimeFr,
  formatAppointmentConfirmation,
  resolveSlotDetails,
  type AppointmentDetails,
} from "../appointment-confirmation";
import { TIME_SLOTS } from "../data";

describe("formatDateFr", () => {
  it("formats a date into spoken French with day of week", () => {
    // 2026-06-10 is a Wednesday
    const result = formatDateFr("2026-06-10");
    expect(result).toBe("mercredi 10 juin 2026");
  });

  it("formats a Monday date", () => {
    // 2026-06-08 is a Monday
    const result = formatDateFr("2026-06-08");
    expect(result).toBe("lundi 8 juin 2026");
  });

  it("formats a date in January", () => {
    // 2026-01-15 is a Thursday
    const result = formatDateFr("2026-01-15");
    expect(result).toBe("jeudi 15 janvier 2026");
  });

  it("formats a date in December", () => {
    // 2026-12-25 is a Friday
    const result = formatDateFr("2026-12-25");
    expect(result).toBe("vendredi 25 decembre 2026");
  });
});

describe("formatTimeFr", () => {
  it("formats a full hour without minutes", () => {
    expect(formatTimeFr("09:00")).toBe("9 heures");
  });

  it("formats time with minutes", () => {
    expect(formatTimeFr("09:30")).toBe("9 heures 30");
  });

  it("formats afternoon time", () => {
    expect(formatTimeFr("14:00")).toBe("14 heures");
  });

  it("formats afternoon time with minutes", () => {
    expect(formatTimeFr("16:30")).toBe("16 heures 30");
  });
});

describe("resolveSlotDetails", () => {
  it("resolves a slot by ID", () => {
    const details = resolveSlotDetails("slot-1", TIME_SLOTS);
    expect(details).toEqual({
      date: "2026-06-10",
      time: "09:00",
      doctor: "Dr. Marie Dupont",
    });
  });

  it("resolves a slot from descriptive string", () => {
    const details = resolveSlotDetails(
      "2026-06-10 a 09:00 avec Dr. Marie Dupont (30 min)",
      TIME_SLOTS
    );
    expect(details).toEqual({
      date: "2026-06-10",
      time: "09:00",
      doctor: "Dr. Marie Dupont",
    });
  });

  it("resolves a slot from descriptive string without duration", () => {
    const details = resolveSlotDetails(
      "2026-06-10 a 14:00 avec Dr. Jean Martin",
      TIME_SLOTS
    );
    expect(details).toEqual({
      date: "2026-06-10",
      time: "14:00",
      doctor: "Dr. Jean Martin",
    });
  });

  it("resolves a slot by date and time fallback", () => {
    const details = resolveSlotDetails("le 2026-06-11 a 09:30", TIME_SLOTS);
    expect(details).toEqual({
      date: "2026-06-11",
      time: "09:30",
      doctor: "Dr. Marie Dupont",
    });
  });

  it("returns undefined for unknown slot", () => {
    const details = resolveSlotDetails("slot-unknown", TIME_SLOTS);
    expect(details).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    const details = resolveSlotDetails("", TIME_SLOTS);
    expect(details).toBeUndefined();
  });
});

describe("formatAppointmentConfirmation", () => {
  it("includes the date clearly in French", () => {
    const details: AppointmentDetails = {
      date: "2026-06-10",
      time: "09:00",
      doctor: "Dr. Marie Dupont",
    };
    const result = formatAppointmentConfirmation(details);
    expect(result).toContain("mercredi 10 juin 2026");
  });

  it("includes the time clearly", () => {
    const details: AppointmentDetails = {
      date: "2026-06-10",
      time: "09:00",
      doctor: "Dr. Marie Dupont",
    };
    const result = formatAppointmentConfirmation(details);
    expect(result).toContain("9 heures");
  });

  it("includes the practitioner name", () => {
    const details: AppointmentDetails = {
      date: "2026-06-10",
      time: "09:00",
      doctor: "Dr. Marie Dupont",
    };
    const result = formatAppointmentConfirmation(details);
    expect(result).toContain("Dr. Marie Dupont");
  });

  it("confirms successful creation", () => {
    const details: AppointmentDetails = {
      date: "2026-06-10",
      time: "09:00",
      doctor: "Dr. Marie Dupont",
    };
    const result = formatAppointmentConfirmation(details);
    expect(result).toContain("enregistre");
  });

  it("produces a complete confirmation with all elements", () => {
    const details: AppointmentDetails = {
      date: "2026-06-11",
      time: "09:30",
      doctor: "Dr. Marie Dupont",
    };
    const result = formatAppointmentConfirmation(details);
    expect(result).toBe(
      "Votre rendez-vous a bien ete enregistre. Il est prevu le jeudi 11 juin 2026 a 9 heures 30 avec Dr. Marie Dupont. Nous vous souhaitons une bonne journee."
    );
  });

  it("works with afternoon appointment", () => {
    const details: AppointmentDetails = {
      date: "2026-06-12",
      time: "16:00",
      doctor: "Dr. Jean Martin",
    };
    const result = formatAppointmentConfirmation(details);
    expect(result).toContain("vendredi 12 juin 2026");
    expect(result).toContain("16 heures");
    expect(result).toContain("Dr. Jean Martin");
  });
});
