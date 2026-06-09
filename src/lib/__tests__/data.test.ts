import { describe, it, expect } from "vitest";
import { OFFICE_INFO, TIME_SLOTS } from "../data";

describe("Fictitious data", () => {
  it("should have office info defined", () => {
    expect(OFFICE_INFO.name).toBeTruthy();
    expect(OFFICE_INFO.address).toBeTruthy();
    expect(OFFICE_INFO.phone).toBeTruthy();
    expect(OFFICE_INFO.doctors.length).toBeGreaterThan(0);
  });

  it("should have between 5 and 10 time slots", () => {
    expect(TIME_SLOTS.length).toBeGreaterThanOrEqual(5);
    expect(TIME_SLOTS.length).toBeLessThanOrEqual(10);
  });

  it("should have at least one available slot", () => {
    const available = TIME_SLOTS.filter((s) => s.available);
    expect(available.length).toBeGreaterThan(0);
  });

  it("should have unique slot IDs", () => {
    const ids = TIME_SLOTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
