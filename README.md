# CreatorOS Model Context Protocol (MCP) Server

[![creatoros-mcp MCP server – quality and maintenance score on Glama](https://glama.ai/mcp/servers/aashuchahal4-crypto/creatoros-mcp/badges/score.svg?1)](https://glama.ai/mcp/servers/aashuchahal4-crypto/creatoros-mcp)
[![CI](https://github.com/aashuchahal4-crypto/creatoros-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/aashuchahal4-crypto/creatoros-mcp/actions)
[![npm version](https://img.shields.io/npm/v/creatoros-mcp.svg?color=blue)](https://www.npmjs.com/package/creatoros-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Official Model Context Protocol (MCP) server for [CreatorOS](https://thecreatoros.dev). Connects **Claude Desktop**, **Cursor**, **Windsurf**, and **Zed** directly to the high-throughput CreatorOS Web-to-Markdown extraction engine, autonomous agent web search, and neural text-to-speech studio.

[![creatoros-mcp MCP server – quality and maintenance score on Glama](https://glama.ai/mcp/servers/aashuchahal4-crypto/creatoros-mcp/badges/card.svg)](https://glama.ai/mcp/servers/aashuchahal4-crypto/creatoros-mcp)

Zero dependencies. Instant startup (<1s).

---

## Capabilities & Tools

| Tool | Description |
| :--- | :--- |
| `creatoros_extract` | Converts any public web page URL into clean, noise-free Markdown with headers, tables, and article metadata stripped of ads and navigation boilerplate. |
| `creatoros_search` | Autonomous multi-URL agent live search. Retrieves fresh web search results and auto-extracts deep Markdown from top matching pages. |
| `creatoros_speak` | Generates natural, human-cadence English voice speech audio from text using CreatorOS Neural Voice Studio (`anna`, `charles`, `alba`, `stuart_bell`). |

---

## Quick Setup

### 1. Claude Desktop Setup
Add this to your Claude Desktop configuration file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "creatoros": {
      "command": "npx",
      "args": ["-y", "creatoros-mcp"]
    }
  }
}
```

*Optional:* If you have an active CreatorOS Developer Pass key, provide it in `env`:
```json
{
  "mcpServers": {
    "creatoros": {
      "command": "npx",
      "args": ["-y", "creatoros-mcp"],
      "env": {
        "CREATOROS_API_KEY": "YOUR_CREATOROS_PASS_KEY"
      }
    }
  }
}
```

### 2. Cursor IDE Setup
1. In Cursor, open **Settings &rarr; Features &rarr; MCP Servers**.
2. Click **+ Add New MCP Server**.
3. Fill in:
   - **Name:** `creatoros`
   - **Type:** `command`
   - **Command:** `npx -y creatoros-mcp`
4. Click Save. Cursor Composer will now automatically call `creatoros_extract` or `creatoros_search` whenever you ask questions about live web documentation!

---

## Example Prompts in Claude / Cursor

- *"Extract the documentation at https://fastapi.tiangolo.com/tutorial/first-steps/ and summarize it."*
- *"Search for the latest Python 3.13 changelog and give me the code examples."*
- *"Synthesize an audio announcement for our product release using the Anna voice."*

---

## Pricing & Rate Limits
- **Free Tier:** 20 web extractions / hour with no API key required.
- **Pro Tier:** Pass-holders get up to 500,000 monthly extractions, dedicated concurrency, and priority voice queues. Get your pass at [https://thecreatoros.dev/#passes](https://thecreatoros.dev/#passes).

---

## License
MIT © [CreatorOS](https://thecreatoros.dev)
