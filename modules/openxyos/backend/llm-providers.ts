export const LLM_PROVIDERS = {
  ollama: {
    provider: "Ollama",
    name: "Ollama (Local)",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "llama3.2",
    local: true,
  },
  deepseek: {
    provider: "DeepSeek",
    name: "DeepSeek V4 Flash",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
  },
  qwen: {
    provider: "阿里云百炼",
    name: "通义千问 Plus",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
  },
  openai: {
    provider: "OpenAI",
    name: "GPT-5 mini",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5-mini",
  },
  gemini: {
    provider: "Google",
    name: "Gemini 2.5 Flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
  },
  mistral: {
    provider: "Mistral AI",
    name: "Mistral Small 4",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-2603",
  },
  claude_openrouter: {
    provider: "Anthropic via OpenRouter",
    name: "Claude Sonnet 4.5",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4.5",
  },
  openrouter_auto: {
    provider: "OpenRouter",
    name: "Auto Router",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/auto",
  },
  zhipu: {
    provider: "智谱 AI",
    name: "GLM-5",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-5",
  },
  moonshot: {
    provider: "月之暗面",
    name: "Moonshot v1 8K",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
  },
} as const;

export type LLMProviderId = keyof typeof LLM_PROVIDERS;
