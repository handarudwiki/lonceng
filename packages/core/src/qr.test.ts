import { describe, expect, it } from "vitest";
import { issueDynamicQr, verifyDynamicQr } from "./qr";

describe("dynamic QR", () => {
  const now = new Date("2026-11-09T00:00:00Z");
  it("accepts a fresh token", () => {
    const { token } = issueDynamicQr("person-1", now);
    expect(verifyDynamicQr(token, now)).toEqual({ valid: true, personId: "person-1" });
  });
  it("rejects a screenshot after the TTL", () => {
    const { token } = issueDynamicQr("person-1", now);
    expect(verifyDynamicQr(token, new Date(now.getTime() + 60_000))).toEqual({ valid: false, reason: "expired" });
  });
  it("rejects a forged person id", () => {
    const { token } = issueDynamicQr("person-1", now);
    expect(verifyDynamicQr(token.replace("person-1", "person-2"), now)).toEqual({ valid: false, reason: "invalid" });
  });
});
