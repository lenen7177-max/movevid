/** A site.config.jsonc with every value filled in. */
export function filledSiteConfig(overrides = {}) {
  return {
    name: "Dance Booth",
    domain: "dancebooth.app",
    mediaUrl: "https://media.dancebooth.app",
    cloudflare: {
      webWorker: "dancebooth-web",
      serverWorker: "dancebooth-server",
      d1DatabaseName: "dancebooth-db",
      d1DatabaseId: "4f6c2a1e-9b3d-4c8e-a7f2-1d5e8b9c0a3f",
      r2Bucket: "dancebooth-bucket",
      rateLimitNamespaceIds: { authEmailIp: "3001", authEmailAddress: "3002" },
    },
    turnstileSiteKey: "0x4AAAAAAAexampleKey",
    public: { githubClientId: "", googleClientId: "" },
    ...overrides,
  };
}
