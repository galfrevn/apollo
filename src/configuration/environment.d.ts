interface Env {
  DEVICE_SHARED_SECRET: string;
  OPENROUTER_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  TAVILY_API_KEY: string;
  RESEND_API_KEY: string;
  MOCK_VOICE?: string;
  // `wrangler types` only emits this while the container binding is active in
  // wrangler.jsonc, and it is commented out until the plan is upgraded.
  Sandbox: DurableObjectNamespace<import('@cloudflare/sandbox').Sandbox>;
}

declare namespace Cloudflare {
  interface Env {
    DEVICE_SHARED_SECRET: string;
    OPENROUTER_API_KEY: string;
    ELEVENLABS_API_KEY: string;
    TAVILY_API_KEY: string;
    RESEND_API_KEY: string;
    MOCK_VOICE?: string;
  }
}
