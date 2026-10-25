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
    description: 'Extracts readable main content from any public web page URL and converts it into clean, noise-free Markdown optimized for LLM context, summarization, and RAG pipelines. Strips advertisements, navigation headers, cookie banners, and scripts while preserving headings, lists, tables, and code blocks.\n\nWhen to use:\n- Call this tool when the user provides a specific URL or asks to read, scrape, summarize, or analyze documentation, blog posts, news articles, or API references from the web.\n\nWhen NOT to use:\n- Do not use for keyword searches without a known URL (use creatoros_search instead).\n- Do not use for private intranet pages or sites behind interactive authentication/login walls.\n\nBehavior:\n- Idempotent and read-only. Does not mutate server state.\n- Returns extracted Markdown as plain text.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          pattern: '^https?:\\/\\/.+',
          description: 'The fully-qualified HTTP or HTTPS URL of the public web page to fetch and convert (e.g. "https://docs.python.org/3/tutorial/").'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'creatoros_search',
    description: 'Executes an autonomous live web search for fresh information and automatically extracts deep Markdown content from the highest-ranking search result pages. Combines web search retrieval and web scraping in a single step for AI agents.\n\nWhen to use:\n- Use when you need real-time, up-to-date web information, breaking news, latest documentation, or answers to queries where no specific target URL is provided.\n\nWhen NOT to use:\n- If the user has already provided an exact web URL to scrape, use creatoros_extract instead.\n\nBehavior:\n- Read-only and non-destructive.\n- Returns a structured Markdown document containing top ranked titles, URLs, text snippets, and extracted page content.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          minLength: 2,
          maxLength: 250,
          description: 'The search query keywords or question to look up on the live web (e.g. "Python 3.13 release changelog features", "FastAPI production best practices").'
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          default: 5,
          description: 'The maximum number of top search results to return and extract (integer between 1 and 5). Default is 5.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'creatoros_speak',
    description: 'Converts English text into natural, studio-quality speech audio with human inflection and cadence using the CreatorOS Neural Voice Studio. Returns a playable audio URL or audio stream.\n\nWhen to use:\n- Use when the user requests spoken voice responses, podcast narration, voiceover scripts, or audio synthesis of text.\n\nWhen NOT to use:\n- Do not use for text extraction, web scraping, or non-audio tasks.\n\nBehavior:\n- Synthesizes neural audio on demand. Free tier supports up to 250 characters per generation; Pro Pass supports up to 5,000 characters.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          minLength: 1,
          maxLength: 5000,
          description: 'The English script to convert into voice audio (up to 250 characters free, 5000 characters with Pro Pass).'
        },
        voice: {
          type: 'string',
          enum: ['anna', 'charles', 'alba', 'stuart_bell'],
          default: 'anna',
          description: 'The voice persona to use: "anna" (warm female), "charles" (deep male), "alba" (bright male), or "stuart_bell" (documentary narrator). Default is "anna".'
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
