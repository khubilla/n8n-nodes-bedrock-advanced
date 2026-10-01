# Patches against upstream

Base: [`n8n-nodes-bedrock-advanced@0.5.2`](https://www.npmjs.com/package/n8n-nodes-bedrock-advanced)
by Amir Souchami, MIT. Upstream publishes only built code (no source
repository), so this fork patches the built file
`dist/nodes/LmChatAwsBedrockAdvanced/LmChatAwsBedrockAdvanced.node.js`.

The first commit in this repo is the unmodified upstream file
(sha256 `9ba5135c6738b8a858bb88831ff1ec915cf4162d76412f7f695c653c86642e2c`).
`scripts/apply-patches.mjs` applies every change below, and refuses to write
unless each anchor matches exactly once.

## 1. Effort option

Upstream builds the chat model with only `client`, `model`, `region`,
`temperature` and `maxTokens`. The LangChain `ChatBedrockConverse` class
underneath already forwards `additionalModelRequestFields` to the Converse API;
upstream never sets it, so there is no way to send `output_config.effort`.

The fork adds an **Effort** option (low / medium / high / xhigh / max). When
set, the model is built with
`additionalModelRequestFields: { output_config: { effort } }`. It works with
prompt caching on or off. When the option is not added to the node, nothing is
sent and the request is identical to upstream.

Why: with caching on, the node could not lower effort, and the model ran at its
default (high), producing noticeably more output tokens.

## 2. Timeout option

Upstream creates the Bedrock client with no request timeout. A request that
hangs never fails. The fork adds a **Timeout (Ms)** option. When set, the
client's `NodeHttpHandler` gets `requestTimeout` plus
`throwOnRequestTimeout: true`. Without the second flag the AWS SDK only logs a
warning and keeps waiting. A configured proxy is still honoured.

## 3. Cache Latest Turn option

Upstream's **Cache Conversation History** puts its cache point on the most
recent message that isn't a tool call or tool result. In an agent's tool loop,
that's always the original input message. So every tool result after it is
re-sent as full-price input on every later call of the run.

The fork adds a **Cache Latest Turn** option, shown under prompt caching and
off by default. When on, every Converse request gets a cache point after its
newest message, whether that's the input or a tool result. Each tool result is
then written to the cache once (1.25× input price) and read on later calls
(0.1×), instead of being paid in full every time.

The cache point is added to the Converse request after LangChain's conversion,
by wrapping the client's `send`. That way it sits beside a `toolResult` block
in the user message, not inside it. Bedrock allows 4 cache points per request:
tools, system, history and the newest turn use exactly that. If 4 are already
present, the oldest message-level cache point is dropped first, because the new
one covers everything it did.

Measured on Claude Sonnet 5.5 with a 3-call tool loop: uncached input per call
went 95 → 3,030 → 5,980 tokens without the option, and 4 → 2 → 2 with it. The
saving grows with run length. A tool result first sent on the last call is
never read again, so it costs 0.25× more.

## 4. Display name

The node shows as **AWS Bedrock Chat Model (Advanced + Effort)**, so it can be
told apart from the upstream node when both are installed. The internal node
name `lmChatAwsBedrockAdvanced` is unchanged. The n8n node type is
`@khubilla/n8n-nodes-bedrock-advanced.lmChatAwsBedrockAdvanced`.

## Not carried over

- The **Bedrock Claude** node (InvokeModel) from the same upstream package.
- `dist/index.js` and all source maps. The maps would no longer match the
  patched file.

## Updating to a new upstream version

1. `npm pack n8n-nodes-bedrock-advanced@<version>` and copy its
   `LmChatAwsBedrockAdvanced.node.js` over the one in `dist/`.
2. Commit that on its own as the new upstream baseline.
3. `npm run patch`, then `npm test`. If an anchor no longer matches, update it
   in `scripts/apply-patches.mjs`.
