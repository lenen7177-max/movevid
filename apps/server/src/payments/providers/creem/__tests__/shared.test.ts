import test from "node:test";
import assert from "node:assert/strict";
import {
  createCreemApiHeaders,
  mapCreemSubscriptionState,
  pickCreemProductId,
  resolveCreemCheckoutCustomer,
  resolveCreemApiBaseUrl,
  verifyCreemWebhookSignature,
} from "../shared";

test("resolveCreemApiBaseUrl uses test endpoint for test-mode keys", () => {
  assert.equal(resolveCreemApiBaseUrl("creem_test_123"), "https://test-api.creem.io/v1");
  assert.equal(resolveCreemApiBaseUrl("creem_live_123"), "https://api.creem.io/v1");
});

test("createCreemApiHeaders uses x-api-key authentication", () => {
  assert.deepEqual(createCreemApiHeaders("creem_test_123"), {
    accept: "application/json",
    "content-type": "application/json",
    "x-api-key": "creem_test_123",
  });
});

test("resolveCreemCheckoutCustomer prefers customer id when id and email are both present", () => {
  assert.deepEqual(
    resolveCreemCheckoutCustomer({
      mode: "payment",
      lineItems: [{ priceId: "prod_lifetime", quantity: 1 }],
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
      customerId: "cus_123",
      customerEmail: "user@example.com",
    }),
    { id: "cus_123" },
  );
});

test("resolveCreemCheckoutCustomer falls back to email when provider customer id is missing", () => {
  assert.deepEqual(
    resolveCreemCheckoutCustomer({
      mode: "payment",
      lineItems: [{ priceId: "prod_lifetime", quantity: 1 }],
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
      customerEmail: "user@example.com",
    }),
    { email: "user@example.com" },
  );
});

test("pickCreemProductId reads the first checkout line item priceId", () => {
  assert.equal(
    pickCreemProductId([
      { priceId: "prod_monthly", quantity: 1 },
      { priceId: "prod_unused", quantity: 1 },
    ]),
    "prod_monthly",
  );
});

test("pickCreemProductId throws when no checkout line item exists", () => {
  assert.throws(() => pickCreemProductId([]), /missing checkout product/i);
});

test("mapCreemSubscriptionState maps scheduled_cancel to active cancel-at-period-end", () => {
  assert.deepEqual(mapCreemSubscriptionState("scheduled_cancel"), {
    status: "active",
    cancelAtPeriodEnd: true,
  });
});

test("mapCreemSubscriptionState maps paused to paused without active access", () => {
  assert.deepEqual(mapCreemSubscriptionState("paused"), {
    status: "paused",
    cancelAtPeriodEnd: false,
  });
});

test("mapCreemSubscriptionState maps past_due to unpaid", () => {
  assert.deepEqual(mapCreemSubscriptionState("past_due"), {
    status: "unpaid",
    cancelAtPeriodEnd: false,
  });
});

test("mapCreemSubscriptionState maps unpaid to unpaid", () => {
  assert.deepEqual(mapCreemSubscriptionState("unpaid"), {
    status: "unpaid",
    cancelAtPeriodEnd: false,
  });
});

test("mapCreemSubscriptionState throws for unsupported subscription states", () => {
  assert.throws(
    () => mapCreemSubscriptionState("mystery_state" as never),
    /unsupported creem subscription state/i,
  );
});

test("verifyCreemWebhookSignature accepts matching HMAC-SHA256 hex digest", () => {
  assert.equal(
    verifyCreemWebhookSignature({
      rawBody: '{"id":"evt_1"}',
      signature: "c7f442cbd5cfb89c121d75aef4525830372b0b25c10d0786494fc51c8dc4d936",
      secret: "creem_secret",
    }),
    true,
  );
});

test("verifyCreemWebhookSignature rejects mismatched signatures", () => {
  assert.equal(
    verifyCreemWebhookSignature({
      rawBody: '{"id":"evt_1"}',
      signature: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      secret: "creem_secret",
    }),
    false,
  );
});
