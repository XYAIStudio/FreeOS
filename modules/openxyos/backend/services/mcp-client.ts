/**
 * V4.2 MCP 协议客户端 (Model Context Protocol Client)
 * 
 * 连接外部 MCP 服务，将外部 AI 能力集成到 XYOS 内部。
 * 支持多个外部 MCP Server 同时连接。
 */

import { FEATURE_FLAGS } from "../config/features";

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

interface MCPRemoteTool {
  serverId: string;
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  enabled: boolean;
}

// ─────────────────────────────────────────────
// 外部 MCP 服务配置
// ─────────────────────────────────────────────

const DEFAULT_MCP_SERVERS: MCPServerConfig[] = [
  {
    id: "filesystem",
    name: "文件系统 MCP",
    url: "http://localhost:3001/mcp",
    enabled: false,
  },
  {
    id: "database",
    name: "数据库 MCP",
    url: "http://localhost:3002/mcp",
    enabled: false,
  },
];

let configuredServers: MCPServerConfig[] = [...DEFAULT_MCP_SERVERS];
const remoteTools: Map<string, MCPRemoteTool[]> = new Map();

// ─────────────────────────────────────────────
// 服务器管理
// ─────────────────────────────────────────────

export function loadServerConfigs(configs: MCPServerConfig[]): void {
  configuredServers = configs;
}

export function getServerConfigs(): MCPServerConfig[] {
  return configuredServers;
}

export function addServerConfig(config: MCPServerConfig): void {
  const existing = configuredServers.findIndex(s => s.id === config.id);
  if (existing >= 0) {
    configuredServers[existing] = config;
  } else {
    configuredServers.push(config);
  }
}

export function removeServerConfig(serverId: string): void {
  configuredServers = configuredServers.filter(s => s.id !== serverId);
  remoteTools.delete(serverId);
}

// ─────────────────────────────────────────────
// 连接外部 MCP 服务
// ─────────────────────────────────────────────

async function connectToServer(server: MCPServerConfig): Promise<boolean> {
  if (!FEATURE_FLAGS.ENABLE_MCP_CLIENT) return false;
  if (!server.enabled) return false;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (server.apiKey) {
      headers["Authorization"] = `Bearer ${server.apiKey}`;
    }

    // 1. 初始化连接
    const initResp = await fetch(`${server.url}/initialize`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: { name: "XYOS-MCP-Client", version: "4.2.0" },
          capabilities: {},
        },
        id: 1,
      }),
    });

    if (!initResp.ok) {
      console.warn(`[MCP-Client] 连接 ${server.name} 失败: ${initResp.status}`);
      return false;
    }

    // 2. 获取工具列表
    const toolsResp = await fetch(`${server.url}/tools/list`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: 2,
      }),
    });

    if (toolsResp.ok) {
      const data = await toolsResp.json();
      const tools: MCPRemoteTool[] = (data.result?.tools || []).map((t: any) => ({
        serverId: server.id,
        serverName: server.name,
        name: t.name,
        description: t.description || "",
        inputSchema: t.inputSchema || {},
      }));
      remoteTools.set(server.id, tools);
      console.log(`[MCP-Client] ${server.name} 已连接，获取到 ${tools.length} 个工具`);
      return true;
    }

    return false;
  } catch (err: any) {
    console.warn(`[MCP-Client] 连接 ${server.name} 异常: ${err.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────
// 调用外部 MCP 工具
// ─────────────────────────────────────────────

export async function callRemoteTool(
  serverId: string,
  toolName: string,
  args: Record<string, any>
): Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }> {
  if (!FEATURE_FLAGS.ENABLE_MCP_CLIENT) {
    return { content: [{ type: "text", text: "MCP Client 功能未启用" }], isError: true };
  }

  const server = configuredServers.find(s => s.id === serverId);
  if (!server) {
    return { content: [{ type: "text", text: `未知 MCP 服务: ${serverId}` }], isError: true };
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (server.apiKey) {
      headers["Authorization"] = `Bearer ${server.apiKey}`;
    }

    const resp = await fetch(`${server.url}/tools/call`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
        id: Date.now(),
      }),
    });

    if (!resp.ok) {
      return { content: [{ type: "text", text: `MCP 调用失败: HTTP ${resp.status}` }], isError: true };
    }

    const data = await resp.json();
    if (data.error) {
      return { content: [{ type: "text", text: `MCP 错误: ${data.error.message}` }], isError: true };
    }

    return data.result || { content: [{ type: "text", text: "MCP 调用返回空结果" }] };
  } catch (err: any) {
    return { content: [{ type: "text", text: `MCP 调用异常: ${err.message}` }], isError: true };
  }
}

// ─────────────────────────────────────────────
// 获取所有可用的远程工具
// ─────────────────────────────────────────────

export function getRemoteTools(): MCPRemoteTool[] {
  const allTools: MCPRemoteTool[] = [];
  remoteTools.forEach(tools => allTools.push(...tools));
  return allTools;
}

export function getRemoteToolsByServer(serverId: string): MCPRemoteTool[] {
  return remoteTools.get(serverId) || [];
}

// ─────────────────────────────────────────────
// 连接所有已启用的外部 MCP 服务
// ─────────────────────────────────────────────

export async function connectAllServers(): Promise<{ connected: number; failed: number }> {
  if (!FEATURE_FLAGS.ENABLE_MCP_CLIENT) {
    console.log("[MCP-Client] MCP Client 功能未启用");
    return { connected: 0, failed: 0 };
  }

  let connected = 0;
  let failed = 0;

  for (const server of configuredServers) {
    if (!server.enabled) continue;
    const ok = await connectToServer(server);
    if (ok) connected++; else failed++;
  }

  console.log(`[MCP-Client] 连接结果: ${connected} 成功, ${failed} 失败`);
  return { connected, failed };
}

// ─────────────────────────────────────────────
// 健康检查
// ─────────────────────────────────────────────

export async function pingServer(serverId: string): Promise<boolean> {
  const server = configuredServers.find(s => s.id === serverId);
  if (!server) return false;

  try {
    const resp = await fetch(`${server.url}/ping`, { method: "GET" });
    return resp.ok;
  } catch {
    return false;
  }
}
