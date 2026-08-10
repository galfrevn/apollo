interface Env {
  DEVICE_SHARED_SECRET: string;
  OPENROUTER_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  TAVILY_API_KEY: string;
  RESEND_API_KEY: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  MOCK_VOICE?: string;
}

declare namespace Cloudflare {
  interface Env {
    DEVICE_SHARED_SECRET: string;
    OPENROUTER_API_KEY: string;
    ELEVENLABS_API_KEY: string;
    TAVILY_API_KEY: string;
    RESEND_API_KEY: string;
    GITHUB_APP_ID: string;
    GITHUB_APP_PRIVATE_KEY: string;
    MOCK_VOICE?: string;
  }
}
