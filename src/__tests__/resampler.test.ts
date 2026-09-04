import { describe, it, expect } from "vitest";
import { toMono16k, TARGET_RATE } from "../lib/resampler";

describe("toMono16k", () => {
  it("returns empty array for empty input", () => {
    const result = toMono16k([], 44100);
    expect(result.length).toBe(0);
  });

  it("returns empty array for single empty channel", () => {
    const result = toMono16k([new Float32Array(0)], 44100);
    expect(result.length).toBe(0);
  });

  it("passthrough when input is already 16kHz mono", () => {
    const input = [new Float32Array([0.1, 0.2, 0.3])];
    const result = toMono16k(input, TARGET_RATE);
    expect(result.length).toBe(3);
    expect(result[0]).toBeCloseTo(0.1);
    expect(result[1]).toBeCloseTo(0.2);
    expect(result[2]).toBeCloseTo(0.3);
  });

  it("averages stereo to mono", () => {
    const left = new Float32Array([1.0, 0.0]);
    const right = new Float32Array([0.0, 1.0]);
    const result = toMono16k([left, right], TARGET_RATE);
    expect(result.length).toBe(2);
    expect(result[0]).toBeCloseTo(0.5);
    expect(result[1]).toBeCloseTo(0.5);
  });

  it("downsamples 44100 to 16000", () => {
    const input = [new Float32Array(44100)];
    for (let i = 0; i < 44100; i++) input[0][i] = Math.sin(2 * Math.PI * 440 * (i / 44100));
    const result = toMono16k(input, 44100);
    const expectedLen = Math.round(44100 * (TARGET_RATE / 44100));
    expect(result.length).toBe(expectedLen);
  });

  it("upsamples 8000 to 16000", () => {
    const input = [new Float32Array(8000).fill(0.5)];
    const result = toMono16k(input, 8000);
    expect(result.length).toBe(16000);
    expect(result[0]).toBeCloseTo(0.5);
  });
});
