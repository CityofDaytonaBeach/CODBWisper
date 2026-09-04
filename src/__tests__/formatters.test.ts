import { describe, it, expect } from "vitest";
import { formatClock, formatHMS, toSRT, toVTT, toPlainText, toJSON } from "../lib/formatters";
import type { Segment } from "../lib/formatters";

const segments: Segment[] = [
  { start: 0, end: 2.5, text: "Hello world" },
  { start: 2.5, end: 5.0, text: "This is a test" },
  { start: 3661.5, end: 3665.0, text: "Over an hour" },
];

describe("formatClock", () => {
  it("formats zero seconds", () => {
    expect(formatClock(0)).toBe("00:00:00,000");
  });

  it("formats milliseconds with comma separator", () => {
    expect(formatClock(1.5)).toBe("00:00:01,500");
  });

  it("formats hours correctly", () => {
    expect(formatClock(3661.5)).toBe("01:01:01,500");
  });

  it("supports dot separator for VTT", () => {
    expect(formatClock(1.5, ".")).toBe("00:00:01.500");
  });
});

describe("formatHMS", () => {
  it("formats seconds only", () => {
    expect(formatHMS(45)).toBe("00:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatHMS(90)).toBe("01:30");
  });

  it("formats hours, minutes, seconds", () => {
    expect(formatHMS(3661)).toBe("01:01:01");
  });
});

describe("toSRT", () => {
  it("produces valid SRT format", () => {
    const result = toSRT(segments.slice(0, 2));
    expect(result).toContain("1\n00:00:00,000 --> 00:00:02,500\nHello world\n");
    expect(result).toContain("2\n00:00:02,500 --> 00:00:05,000\nThis is a test\n");
  });
});

describe("toVTT", () => {
  it("starts with WEBVTT header", () => {
    const result = toVTT(segments.slice(0, 1));
    expect(result).toMatch(/^WEBVTT\n\n/);
  });

  it("uses dot as millisecond separator", () => {
    const result = toVTT(segments.slice(0, 1));
    expect(result).toContain("00:00:00.000 --> 00:00:02.500");
  });
});

describe("toPlainText", () => {
  it("joins segment text with newlines", () => {
    const result = toPlainText(segments);
    expect(result).toBe("Hello world\nThis is a test\nOver an hour");
  });
});

describe("toJSON", () => {
  it("produces valid JSON", () => {
    const result = toJSON(segments);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].text).toBe("Hello world");
  });
});
