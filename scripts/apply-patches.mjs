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
