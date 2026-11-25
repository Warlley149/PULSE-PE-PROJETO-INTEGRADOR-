import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
  vi.restoreAllMocks();
});

// Polyfill scrollTo in jsdom
if (typeof window !== "undefined") {
  window.scrollTo = vi.fn();
}
