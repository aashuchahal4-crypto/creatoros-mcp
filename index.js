#!/usr/bin/env node
/**
 * Official CreatorOS Model Context Protocol (MCP) Server
 * Zero external dependencies. Works on Node.js 18+.
 * https://thecreatoros.dev
 */

const readline = require('readline');
const https = require('https');
const http = require('http');
const url = require('url');

const CREATOROS_HOST = process.env.CREATOROS_HOST || 'https://thecreatoros.dev';
const CREATOROS_API_KEY = process.env.CREATOROS_API_KEY || '';

const TOOLS = [
  {
    name: 'creatoros_extract',
    description: 'Converts any public webpage into clean, noise-free Markdown formatted for LLMs and RAG pipelines. Strips ads, navigation, and tracker scripts.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The public web page URL to fetch and convert into Markdown (e.g. https://example.com/blog).'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'creatoros_search',
    description: 'Autonomous multi-URL agent live web search. Retrieves fresh search results and automatically extracts deep Markdown from the top matching pages.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up (e.g. "latest Python 3.13 release notes", "FastAPI RAG tutorial").'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of search results to return (1 to 5). Default is 5.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'creatoros_speak',
    description: 'Generates natural studio-grade English voice speech from text using the CreatorOS Neural Voice Studio.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The English text script to convert into voice audio (up to 250 characters free, 5000 characters with Pro Pass).'
        },
        voice: {
          type: 'string',
          description: 'Voice persona: "anna" (warm female), "charles" (deep male), "alba" (bright male), "stuart_bell" (narrator). Default is "anna".'
        }
      },
      required: ['text']
    }
  }
];

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(options.url || options);
    const client = parsed.protocol === 'http:' ? http : https;
    const reqOptions = {
      method: options.method || 'GET',
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
      path: parsed.pathname + parsed.search,
      headers: Object.assign({
        'User-Agent': 'CreatorOS-MCP/1.0.0 (https://thecreatoros.dev)'
      }, options.headers || {})
    };

    if (CREATOROS_API_KEY && !reqOptions.headers['Authorization']) {
      reqOptions.headers['Authorization'] = `Bearer ${CREATOROS_API_KEY}`;
    }

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout from CreatorOS'));
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function handleToolCall(name, args) {
  if (name === 'creatoros_extract') {
    if (!args || !args.url) {
      throw new Error('Argument "url" is required.');
    }
    const targetUrl = args.url.trim();
    const endpoint = `${CREATOROS_HOST}/md/${targetUrl}`;
    const res = await request({ url: endpoint, method: 'GET' });
    if (res.statusCode >= 400) {
      return `[Error ${res.statusCode}] Failed to extract ${targetUrl}: ${res.body.trim()}`;
    }
    return res.body;
  }

  if (name === 'creatoros_search') {
    if (!args || !args.query) {
      throw new Error('Argument "query" is required.');
    }
    const q = args.query.trim();
    const limit = Math.min(Math.max(parseInt(args.limit, 10) || 5, 1), 5);
    const endpoint = `${CREATOROS_HOST}/api/search`;
    const res = await request({
      url: endpoint,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { query: q, limit: limit });

    if (res.statusCode >= 400) {
      return `[Error ${res.statusCode}] Search failed: ${res.body.trim()}`;
    }

    try {
      const data = JSON.parse(res.body);
      let output = `# Search Results for: "${q}"\n\n`;
      if (Array.isArray(data.results)) {
        data.results.forEach((item) => {
          output += `### ${item.rank}. [${item.title}](${item.url})\n`;
          output += `${item.snippet}\n\n`;
          if (item.content) {
            output += `**Extracted Content Preview:**\n\`\`\`markdown\n${item.content.slice(0, 1500)}\n...\n\`\`\`\n\n`;
          }
        });
      }
      return output;
    } catch {
      return res.body;
    }
  }

  if (name === 'creatoros_speak') {
    if (!args || !args.text) {
      throw new Error('Argument "text" is required.');
    }
    const endpoint = `${CREATOROS_HOST}/api/tts/generate`;
    const res = await request({
      url: endpoint,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      text: args.text.trim(),
      voice: args.voice || 'anna'
    });

    if (res.statusCode >= 400) {
      return `[Error ${res.statusCode}] Voice synthesis request failed: ${res.body.trim()}`;
    }

    const init = JSON.parse(res.body);
    if (!init.job_id) {
      return `Voice generation response: ${res.body}`;
    }

    // Poll for status up to 30 seconds
    const jobId = init.job_id;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await request({ url: `${CREATOROS_HOST}/api/tts/status?job_id=${jobId}` });
      if (pollRes.statusCode === 200) {
        const job = JSON.parse(pollRes.body);
        if (job.status === 'completed' && job.audio_url) {
          return `Speech synthesized successfully!\n\nAudio URL: ${CREATOROS_HOST}${job.audio_url}\nVoice: ${job.voice}\nDuration: ${(job.text || '').length} characters processed.`;
        }
        if (job.status === 'failed') {
          return `Voice synthesis failed: ${job.error || 'Unknown error'}`;
        }
      }
    }
    return `Audio job enqueued with Job ID: ${jobId}. Still processing; please check status shortly.`;
  }

  throw new Error(`Unknown tool: ${name}`);
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function sendError(id, code, message) {
  send({
    jsonrpc: '2.0',
    id: id,
    error: { code: code, message: message }
  });
}

function startServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  process.stderr.write('CreatorOS MCP Server started.\n');

  rl.on('line', async (line) => {
    line = line.trim();
    if (!line) return;

    let req;
    try {
      req = JSON.parse(line);
    } catch (e) {
      return sendError(null, -32700, 'Parse error: invalid JSON');
    }

    const { id, method, params } = req;

    try {
      if (method === 'initialize') {
        return send({
          jsonrpc: '2.0',
          id: id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'creatoros-mcp',
              version: '1.0.0'
            }
          }
        });
      }

      if (method === 'notifications/initialized') {
        // Notification from client; no response required
        return;
      }

      if (method === 'ping') {
        return send({ jsonrpc: '2.0', id: id, result: {} });
      }

      if (method === 'tools/list') {
        return send({
          jsonrpc: '2.0',
          id: id,
          result: { tools: TOOLS }
        });
      }

      if (method === 'tools/call') {
        const { name, arguments: toolArgs } = params || {};
        try {
          const resultText = await handleToolCall(name, toolArgs);
          return send({
            jsonrpc: '2.0',
            id: id,
            result: {
              content: [
                {
                  type: 'text',
                  text: resultText
                }
              ]
            }
          });
        } catch (err) {
          return send({
            jsonrpc: '2.0',
            id: id,
            result: {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Error executing ${name}: ${err.message}`
                }
              ]
            }
          });
        }
      }

      // Method not found
      if (id !== undefined) {
        return sendError(id, -32601, `Method not found: ${method}`);
      }
    } catch (outerErr) {
      process.stderr.write(`Unhandled MCP error: ${outerErr.message}\n`);
      if (id !== undefined) {
        sendError(id, -32603, outerErr.message);
      }
    }
  });

  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, handleToolCall, TOOLS };
