# n8n-nodes-bedrock-advanced

Advanced n8n community nodes for AWS Bedrock, providing features not available in the official n8n Bedrock node. This package includes two nodes:

| Node | API | Best For |
|------|-----|----------|
| **AWS Bedrock Chat Model (Advanced)** | Converse API | Multi-model support (Claude, Nova, Titan) with prompt caching |
| **Bedrock Claude** | InvokeModel API | Full access to Claude-specific features |

## Installation

### In n8n (community node)

1. Go to **Settings > Community Nodes**
2. Enter `n8n-nodes-bedrock-advanced`
3. Click **Install**

### Manual installation

```bash
cd ~/.n8n
npm install n8n-nodes-bedrock-advanced
```

Then restart n8n.

---

## Node 1: AWS Bedrock Chat Model (Advanced)

A drop-in replacement for the official [n8n AWS Bedrock Chat Model node](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatawsbedrock/), adding **granular prompt caching** and **accurate token usage metrics** via the Bedrock Converse API.

### Features

- **Granular prompt caching** — independently cache the system prompt, tool definitions, and conversation history
- **Configurable cache TTL** — 5 minutes or 1 hour (where supported)
- **Accurate token usage metrics** including cache read/write breakdowns
- **Multi-model support** — works with Claude, Amazon Nova, Titan, and any Converse API-compatible model
- On-demand models and inference profiles
- Debug logging toggle

### Prompt Caching

When enabled, you can independently target three parts of the request for caching:

| Cache Target | Default | Description |
|---|---|---|
| **Cache System Prompt** | On | Injects a `cachePoint` after the system message |
| **Cache Tool Definitions** | Off | Injects a `cachePoint` after the last tool definition. TTL is preserved accurately. |
| **Cache Conversation History** | Off | Injects a `cachePoint` at the end of the most recent prior turn, reducing cost in multi-turn conversations as history grows |

**Supported TTL options:**

| TTL | Supported Models |
|-----|-----------------|
| 5 minutes | All cacheable models (Claude 3.5 Sonnet v2, Claude 3.7 Sonnet, Claude Sonnet 4, Amazon Nova, etc.) |
| 1 hour | Claude Opus 4.5/4.6, Claude Sonnet 4.5/4.6, Claude Haiku 4.5 |

> **Note:** Due to a LangChain limitation ([#9014](https://github.com/langchain-ai/langchainjs/issues/9014)), the TTL field is stripped from system and conversation history cache points at the LangChain conversion layer. These always use the 5-minute default regardless of the TTL setting. Tool cache points preserve the TTL correctly.

**Requirements:**
- Cached content must remain identical across requests for cache hits
- Minimum token thresholds apply per model (1,024 for Sonnet/Nova, 4,096 for Opus/Haiku)

### Token Usage Metrics

Every execution reports accurate token counts in n8n's AI panel:

```json
{
  "tokenUsage": {
    "inputTokens": 150,
    "outputTokens": 500,
    "totalTokens": 650,
    "cacheReadInputTokens": 120,
    "cacheWriteInputTokens": 0
  }
}
```

### Configuration

1. Add the **AWS Bedrock Chat Model (Advanced)** node to your workflow
2. Select your AWS credentials
3. Choose your model (on-demand or inference profile)
4. Under **Options**:
   - Toggle **Prompt Caching** and select TTL
   - Enable **Cache System Prompt**, **Cache Tool Definitions**, and/or **Cache Conversation History**
   - Adjust temperature and max tokens
   - Toggle **Debug Logs** to see detailed request/response logs

---

## Node 2: Bedrock Claude

A Claude-specific node that uses the Bedrock **InvokeModel API** with the native Anthropic Messages API format. This bypasses the Converse API abstraction layer, giving full access to Claude-specific features.

### Features

- **Granular prompt caching** — independently cache the system prompt, tool definitions, and conversation history, with full TTL control
- **Built-in Claude tools** — web search, computer use, bash, text editor
- **Tool search** — Claude dynamically discovers and loads tools on-demand from large tool sets
- **Programmatic tool calling** — Claude calls tools from within code execution, reducing latency in multi-tool workflows
- **Extended 1M context window** — for Claude Opus 4.6 and Sonnet 4.6
- **Context compaction** — automatically summarizes older context when approaching the context window limit
- **Streaming** support
- **Tool calling** with full multi-turn conversation support
- Debug logging toggle

### Why use this instead of the Advanced node?

| Feature | Converse API (Advanced node) | InvokeModel (Bedrock Claude) |
|---------|:---:|:---:|
| Multi-model support | Yes | Claude only |
| Standard tool calling | Yes | Yes |
| Prompt caching — system prompt | Yes | Yes |
| Prompt caching — tool definitions | Yes | Yes (full TTL control) |
| Prompt caching — conversation history | Yes | Yes |
| Web search tool | No | Yes |
| Computer use tool | No | Yes |
| Bash tool | No | Yes |
| Text editor tool | No | Yes |
| Tool search | No | Yes |
| Programmatic tool calling | No | Yes |
| 1M context window | No | Yes |
| Context compaction | No | Yes |

### Prompt Caching

When enabled, you can independently target three parts of the request:

| Cache Target | Default | Description |
|---|---|---|
| **Cache System Prompt** | On | Adds `cache_control` to the last system message block |
| **Cache Tool Definitions** | Off | Adds `cache_control` to the last non-deferred tool. Safe to use alongside Tool Search — deferred tools are excluded from the cache prefix automatically. |
| **Cache Conversation History** | Off | Adds `cache_control` at the end of the most recent prior turn |

**Cache TTL** (5m or 1h) is fully preserved for all three targets.

### Built-in Claude Tools

Enable these directly in the node options — no external tool setup required:

- **Web Search** — Claude can search the web during conversations
- **Computer Use** — Claude can control mouse, keyboard, and take screenshots (configurable display dimensions)
- **Bash** — Claude can execute shell commands
- **Text Editor** — Claude can view and edit files

### Tool Search

When enabled, agent tools are marked as `defer_loading: true`. Claude uses a search tool (regex or BM25) to discover and load only the tools relevant to each step — reducing prompt size and cost when working with large tool sets.

Tool caching and tool search are fully compatible: `cache_control` is placed on the last non-deferred tool (built-in tools), and deferred agent tools follow after. This means the cache prefix is stable across calls even as Claude selectively loads different agent tools.

### Programmatic Tool Calling

Allows Claude to call tools from within code execution (via the `code_execution` tool), chaining multiple tool uses in a single server-side step. Reduces round-trips and token usage in multi-tool workflows.

### Context Compaction

Automatically summarizes older parts of the conversation when the input approaches the configured token threshold, allowing effective conversations beyond 200K tokens without hitting context limits.

### 1M Context Window

Enables the extended 1M token context window (default is 200K). Supported on Claude Opus 4.6 and Sonnet 4.6.

### Configuration

1. Add the **Bedrock Claude** node to your workflow
2. Select your AWS credentials
3. Choose your Claude model (the dropdown filters to Claude inference profiles only)
4. Under **Options**:
   - Set **Max Tokens** and **Temperature**
   - Toggle **Prompt Caching** and select TTL
   - Enable **Cache System Prompt**, **Cache Tool Definitions**, and/or **Cache Conversation History**
   - Enable any **built-in tools** (web search, computer use, bash, text editor)
   - Toggle **Tool Search** and choose variant (regex or BM25)
   - Toggle **Programmatic Tool Calling**
   - Toggle **Enable 1M Context**
   - Toggle **Enable Compaction** and set trigger token threshold
   - Toggle **Debug Logs**

---

## AWS IAM Permissions

Both nodes require the following IAM permissions:

```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream",
    "bedrock:ListFoundationModels",
    "bedrock:ListInferenceProfiles",
    "bedrock:GetInferenceProfile"
  ],
  "Resource": "*"
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev
```

## License

MIT
