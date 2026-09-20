export const EXPERIENCE_MODELS = [
  { id: "ollama", provider: "Ollama", name: "Ollama (Local)", baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.2", hint: "本机模型，无需云厂商密钥", hintEn: "Local models, no cloud API key", local: true },
  { id: "deepseek", provider: "DeepSeek", name: "DeepSeek V4 Flash", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", hint: "高性价比推理与通用对话", hintEn: "Cost-efficient reasoning and general chat" },
  { id: "qwen", provider: "阿里云百炼", name: "通义千问 Plus", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", hint: "中文与企业场景", hintEn: "Chinese and enterprise scenarios" },
  { id: "openai", provider: "OpenAI", name: "GPT-5 mini", baseUrl: "https://api.openai.com/v1", model: "gpt-5-mini", hint: "通用智能与工具调用", hintEn: "General intelligence and tool use" },
  { id: "gemini", provider: "Google", name: "Gemini 2.5 Flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", hint: "多模态与高吞吐推理", hintEn: "Multimodal, high-throughput reasoning" },
  { id: "mistral", provider: "Mistral AI", name: "Mistral Small 4", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-2603", hint: "高效开源权重模型", hintEn: "Efficient open-weight model" },
  { id: "claude_openrouter", provider: "Anthropic via OpenRouter", name: "Claude Sonnet 4.5", baseUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-sonnet-4.5", hint: "长上下文与复杂推理", hintEn: "Long context and complex reasoning" },
  { id: "openrouter_auto", provider: "OpenRouter", name: "Auto Router", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/auto", hint: "自动选择最适合的模型", hintEn: "Automatically selects a suitable model" },
  { id: "zhipu", provider: "智谱 AI", name: "GLM-5", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5", hint: "中文智能与长任务", hintEn: "Chinese intelligence and long-running tasks" },
  { id: "moonshot", provider: "月之暗面", name: "Moonshot v1 8K", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k", hint: "长文本与中文对话", hintEn: "Long context and Chinese conversation" },
] as const;

export type ExperienceModelId = typeof EXPERIENCE_MODELS[number]["id"];
