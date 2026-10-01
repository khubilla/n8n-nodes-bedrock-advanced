# @khubilla/n8n-nodes-bedrock-advanced

An n8n community node: **AWS Bedrock Chat Model (Advanced + Effort)**.

It's a fork of [`n8n-nodes-bedrock-advanced`](https://www.npmjs.com/package/n8n-nodes-bedrock-advanced)
0.5.2 by Amir Souchami, which adds Bedrock prompt caching to n8n's chat model.
This fork keeps caching as it is and adds three options that upstream can't
express:

| Option | What it sends | Default when added |
|---|---|---|
| **Effort** | `output_config.effort` on every Converse request (low, medium, high, xhigh or max) | medium |
| **Timeout (Ms)** | Fails a Bedrock request that runs longer than this | 180000 |
| **Cache Latest Turn** | A cache point after the newest message, so an agent's tool results are cached as the run goes on (shown under prompt caching) | off |

All are optional. If you don't add them to a node, requests are identical to
upstream 0.5.2. See [PATCHES.md](PATCHES.md) for exactly what changed and why.

## Install

In n8n: **Settings → Community nodes → Install**, then enter
`@khubilla/n8n-nodes-bedrock-advanced`.

It can be installed alongside the upstream package. The node type is
`@khubilla/n8n-nodes-bedrock-advanced.lmChatAwsBedrockAdvanced`.

## Effort

Effort controls how much the model thinks and how many output tokens it
spends. It applies to Claude models that support it (Sonnet 5, Opus 4.6 and
later). Leave it unset for other models.

## Tests

```bash
npm install
npm test
```

The tests make no AWS calls. They stub the Bedrock client to check that
effort reaches the Converse request and that caching still adds its cache
points. They use a local server that never answers to check that the timeout
fails the request.

For the options the upstream node offers (caching targets, TTL, debug logs),
see [UPSTREAM-README.md](UPSTREAM-README.md).

## License

MIT. See [LICENSE](LICENSE).
