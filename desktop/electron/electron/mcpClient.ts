import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types';
import log from 'electron-log';

export interface CallToolResponse {
  content: string;
  raw: unknown;
  isError: boolean;
  mimeType?: string;
}

export class McpClientManager {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private endpoint: string | null = null;
  private toolsCache: Tool[] | null = null;
  private connecting: Promise<void> | null = null;

  constructor(private readonly impl = { name: 'xiaohongshu-agent-desktop', version: '0.1.0' }) {}

  async connect(baseUrl: string) {
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/mcp`;
    if (this.endpoint === endpoint && this.client) {
      return;
    }
    await this.disconnect();

    this.endpoint = endpoint;
    this.transport = new StreamableHTTPClientTransport(endpoint, {
      fetch: globalThis.fetch.bind(globalThis),
      requestInit: {
        headers: {
          'User-Agent': 'xiaohongshu-agent-desktop'
        }
      }
    });

    this.client = new Client(this.impl);
    this.connecting = this.client
      .connect(this.transport)
      .then(() => {
        log.info('MCP session established', endpoint);
      })
      .catch((error) => {
        log.error('Failed to connect MCP server', error);
        this.client = null;
        throw error;
      })
      .finally(() => {
        this.connecting = null;
      });
    await this.connecting;
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        log.warn('Failed to close MCP client gracefully', error);
      }
      this.client = null;
    }
    if (this.transport) {
      try {
        await this.transport.terminateSession();
      } catch (error) {
        log.warn('Failed to terminate MCP session', error);
      }
      this.transport = null;
    }
    this.toolsCache = null;
  }

  async listTools(baseUrl?: string): Promise<Tool[]> {
    await this.ensureConnected(baseUrl);
    if (!this.client) {
      throw new Error('MCP client not connected');
    }
    if (this.toolsCache) {
      return this.toolsCache;
    }
    const result = await this.client.listTools();
    this.toolsCache = result.tools ?? [];
    return this.toolsCache;
  }

  async callTool(name: string, args: Record<string, unknown>, baseUrl?: string): Promise<CallToolResponse> {
    log.info('MCP callTool request', { name, args, baseUrl });
    await this.ensureConnected(baseUrl);
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      const startTime = Date.now();
      const response = await this.client.callTool({
        name,
        arguments: args
      });
      const duration = Date.now() - startTime;
      log.info('MCP callTool response', {
        name,
        duration: `${duration}ms`,
        isError: response.isError,
        contentCount: response.content?.length ?? 0
      });

      const textParts: string[] = [];
      if (response.content) {
        for (const item of response.content) {
          if (item.type === 'text') {
            textParts.push(item.text);
          } else if (item.type === 'image') {
            textParts.push(`[图片(${item.mimeType ?? 'unknown'})，base64大小=${item.data.length}]`);
          }
        }
      }

      return {
        content: textParts.join('\n'),
        raw: response,
        isError: Boolean(response.isError)
      };
    } catch (error) {
      log.error('MCP callTool error', {
        name,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async ensureConnected(baseUrl?: string) {
    if (baseUrl && this.endpoint !== `${baseUrl.replace(/\/+$/, '')}/mcp`) {
      await this.connect(baseUrl);
      return;
    }
    if (!this.client) {
      if (!this.endpoint && baseUrl) {
        await this.connect(baseUrl);
      } else if (this.connecting) {
        await this.connecting;
      } else {
        throw new Error('MCP client not initialized');
      }
    }
  }
}

