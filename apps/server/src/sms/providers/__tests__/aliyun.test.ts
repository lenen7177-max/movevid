import assert from "node:assert/strict";
import test from "node:test";
import {
  AliyunSmsError,
  isAliyunSmsSupportedPhoneNumber,
  percentEncode,
  toCanonicalQueryString,
} from "../aliyun";

test("isAliyunSmsSupportedPhoneNumber accepts only +86 mobile shape", () => {
  assert.equal(isAliyunSmsSupportedPhoneNumber("+8613800138000"), true);
  assert.equal(isAliyunSmsSupportedPhoneNumber("+861380013800"), false);
  assert.equal(isAliyunSmsSupportedPhoneNumber("+12025550123"), false);
  assert.equal(isAliyunSmsSupportedPhoneNumber("8613800138000"), false);
});

test("percentEncode matches RFC 3986 for Aliyun-signing reserved chars", () => {
  // Space → %20, not "+"
  assert.equal(percentEncode("a b"), "a%20b");
  // RFC 3986 unreserved marks that encodeURIComponent leaves alone must be percent-encoded.
  assert.equal(percentEncode("!'()*"), "%21%27%28%29%2A");
  // Canonical reserved characters.
  assert.equal(percentEncode("a/b+c=d&e"), "a%2Fb%2Bc%3Dd%26e");
});

test("toCanonicalQueryString sorts by key and percent-encodes", () => {
  assert.equal(
    toCanonicalQueryString({
      PhoneNumber: "13800138000",
      CountryCode: "86",
      SignName: "速通互联验证码",
    }),
    // Aliyun requires ascending key order after percent-encoding.
    "CountryCode=86&PhoneNumber=13800138000&SignName=%E9%80%9F%E9%80%9A%E4%BA%92%E8%81%94%E9%AA%8C%E8%AF%81%E7%A0%81",
  );
});

test("toCanonicalQueryString skips empty and undefined values", () => {
  assert.equal(
    toCanonicalQueryString({
      A: "1",
      B: "",
      C: undefined,
      D: 0,
    }),
    // `0` stringifies to "0" which is non-empty, so it must appear.
    "A=1&D=0",
  );
});

test("AliyunSmsError surfaces code, requestId, and http status in the message", () => {
  const error = new AliyunSmsError({
    code: "InvalidParameter",
    message: "phone number illegal",
    requestId: "abc-123",
    httpStatus: 400,
  });
  assert.equal(error.code, "InvalidParameter");
  assert.equal(error.requestId, "abc-123");
  assert.equal(error.httpStatus, 400);
  assert.match(error.message, /InvalidParameter/);
  assert.match(error.message, /abc-123/);
  assert.match(error.message, /http 400/);
});
