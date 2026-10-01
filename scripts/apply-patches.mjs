// Applies this fork's patches to the upstream dist file, in place.
//
//   node scripts/apply-patches.mjs
//
// Every anchor must match exactly once, or the script exits without writing, so
// a changed upstream build fails loudly instead of being half-patched. See
// PATCHES.md for what each patch does and why.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL(
  '../dist/nodes/LmChatAwsBedrockAdvanced/LmChatAwsBedrockAdvanced.node.js',
  import.meta.url,
);

const PATCHES = [
  {
    name: 'display name distinguishes the fork in the node picker',
    find: 'displayName: "AWS Bedrock Chat Model (Advanced)",',
    replace: 'displayName: "AWS Bedrock Chat Model (Advanced + Effort)",',
  },
  {
    name: 'Effort and Timeout options in the UI',
    find: `            {
              displayName: "Enable Debug Logs",
              name: "enableDebugLogs",`,
    replace: `            {
              displayName: "Effort",
              name: "effort",
              type: "options",
              options: [
                { name: "Low", value: "low" },
                { name: "Medium", value: "medium" },
                { name: "High", value: "high" },
                { name: "Extra High", value: "xhigh" },
                { name: "Max", value: "max" }
              ],
              default: "medium",
              description: "Sent as output_config.effort. Lower effort means less thinking and fewer output tokens. Claude models that support effort only (e.g. Sonnet 5, Opus 4.6+); leave unset for other models."
            },
            {
              displayName: "Timeout (Ms)",
              name: "timeout",
              type: "number",
              default: 18e4,
              typeOptions: { minValue: 1 },
              description: "Fail a Bedrock request that takes longer than this many milliseconds. Without it a hung request never times out."
            },
            {
              displayName: "Enable Debug Logs",
              name: "enableDebugLogs",`,
  },
  {
    name: 'request timeout on the Bedrock client (with or without a proxy)',
    find: `    if (proxyAgent) {
      clientConfig.requestHandler = new import_node_http_handler5.NodeHttpHandler({
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent
      });
    }`,
    replace: `    if (proxyAgent || options.timeout) {
      clientConfig.requestHandler = new import_node_http_handler5.NodeHttpHandler({
        ...proxyAgent && { httpAgent: proxyAgent, httpsAgent: proxyAgent },
        ...options.timeout && { requestTimeout: options.timeout, throwOnRequestTimeout: true }
      });
    }`,
  },
  {
    name: 'Cache Latest Turn option in the UI',
    find: `              description: "Whether to add a cache point at the end of the most recent previous assistant turn. Reduces cost in multi-turn conversations by caching the growing history.",
              displayOptions: {
                show: {
                  enablePromptCaching: [true]
                }
              }
            },`,
    replace: `              description: "Whether to add a cache point at the end of the most recent previous assistant turn. Reduces cost in multi-turn conversations by caching the growing history.",
              displayOptions: {
                show: {
                  enablePromptCaching: [true]
                }
              }
            },
            {
              displayName: "Cache Latest Turn",
              name: "cacheLatestTurn",
              type: "boolean",
              default: false,
              description: "Whether to add a cache point after the newest message on every call, including tool results. In an agent's tool loop each result is then written to the cache once and read cheaply on later calls, instead of being re-sent as uncached input. Keeps within Bedrock's limit of 4 cache points.",
              displayOptions: {
                show: {
                  enablePromptCaching: [true]
                }
              }
            },`,
  },
  {
    name: 'Cache Latest Turn: cache point after the newest message, added to the converted request',
    // Added on the Converse request itself, after LangChain's conversion, so the
    // cache point sits beside a toolResult block rather than inside it.
    find: `      onFailedAttempt: (0, import_ai_utilities.makeN8nLlmFailedAttemptHandler)(this)
    });
    return {
      response: model
    };`,
    replace: `      onFailedAttempt: (0, import_ai_utilities.makeN8nLlmFailedAttemptHandler)(this)
    });
    if (options.enablePromptCaching && options.cacheLatestTurn) {
      const MAX_CACHE_POINTS = 4;
      const countCachePoints = (blocks) => (blocks || []).filter((b) => b && b.cachePoint).length;
      const addLatestTurnCachePoint = (input) => {
        const messages = input?.messages;
        const last = Array.isArray(messages) ? messages[messages.length - 1] : void 0;
        if (!Array.isArray(last?.content) || last.content.length === 0) return;
        if (last.content[last.content.length - 1]?.cachePoint) return;
        let total = countCachePoints(input.system) + countCachePoints(input.toolConfig?.tools) + messages.reduce((n, m) => n + countCachePoints(m.content), 0);
        if (total >= MAX_CACHE_POINTS) {
          // Make room by dropping the oldest message-level cache point: the new one covers everything it did.
          for (const m of messages) {
            const i = (m.content || []).findIndex((b) => b && b.cachePoint);
            if (i !== -1) { m.content.splice(i, 1); total--; break; }
          }
          if (total >= MAX_CACHE_POINTS) return;
        }
        last.content.push({ cachePoint: { type: "default" } });
      };
      const send = client2.send.bind(client2);
      client2.send = (command, ...rest) => {
        addLatestTurnCachePoint(command?.input);
        return send(command, ...rest);
      };
    }
    return {
      response: model
    };`,
  },
  {
    name: 'effort sent as additionalModelRequestFields.output_config',
    find: `      maxTokens: options.maxTokensToSample,
      callbacks: [new import_ai_utilities.N8nLlmTracing(this)],`,
    replace: `      maxTokens: options.maxTokensToSample,
      ...options.effort && { additionalModelRequestFields: { output_config: { effort: options.effort } } },
      callbacks: [new import_ai_utilities.N8nLlmTracing(this)],`,
  },
];

let src = readFileSync(FILE, 'utf8');
for (const p of PATCHES) {
  const count = src.split(p.find).length - 1;
  if (count !== 1) {
    console.error(`Anchor for "${p.name}" matched ${count} times (expected 1). Nothing written.`);
    process.exit(1);
  }
  src = src.replace(p.find, () => p.replace);
}
writeFileSync(FILE, src);
console.log(`Applied ${PATCHES.length} patches to ${FILE.pathname}`);
