// Tests for the fork's two additions (effort, request timeout) and a guard that
// the upstream prompt-caching behaviour is untouched. No AWS calls: the Bedrock
// client's send() is replaced, and the timeout test uses a local server that
// never answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { LmChatAwsBedrockAdvanced } = require(
  '../dist/nodes/LmChatAwsBedrockAdvanced/LmChatAwsBedrockAdvanced.node.js',
);

const MODEL = 'arn:aws:bedrock:ap-southeast-1:000000000000:application-inference-profile/test';

function context(options) {
  const params = { model: MODEL, modelSource: 'inferenceProfile', options };
  return {
    getCredentials: async () => ({
      region: 'ap-southeast-1',
      accessKeyId: 'AKIDTEST',
      secretAccessKey: 'secret',
    }),
    getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
    getNode: () => ({ name: 'Bedrock', type: 'lmChatAwsBedrockAdvanced', typeVersion: 1 }),
    getWorkflow: () => ({ id: 'wf', name: 'wf' }),
    getExecutionId: () => 'exec',
    getExecutionCancelSignal: () => undefined,
    addInputData: () => ({ index: 0 }),
    addOutputData: () => {},
    logger: { info() {}, debug() {}, warn() {}, error() {} },
  };
}

async function supply(options) {
  const node = new LmChatAwsBedrockAdvanced();
  const { response: model } = await node.supplyData.call(context(options), 0);
  return model;
}

// Replace client.send with a stub that records the Converse input.
function captureSend(model) {
  const sent = [];
  model.client.send = async (command) => {
    sent.push(command.input);
    return {
      output: { message: { role: 'assistant', content: [{ text: 'ok' }] } },
      stopReason: 'end_turn',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    };
  };
  return sent;
}

const MESSAGES = [
  ['system', 'You are a claims assistant. '.repeat(20)],
  ['human', 'Hello'],
];

test('effort is sent as output_config.effort on the Converse request', async () => {
  const model = await supply({ enablePromptCaching: true, cacheSystemPrompt: true, effort: 'medium' });
  const sent = captureSend(model);
  await model.invoke(MESSAGES);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].additionalModelRequestFields, { output_config: { effort: 'medium' } });
});

test('prompt caching still injects the system cache point alongside effort', async () => {
  const model = await supply({ enablePromptCaching: true, cacheSystemPrompt: true, effort: 'medium' });
  const sent = captureSend(model);
  await model.invoke(MESSAGES);
  assert.ok(
    sent[0].system.some((block) => block.cachePoint),
    `expected a cachePoint in system, got ${JSON.stringify(sent[0].system)}`,
  );
});

test('effort works with caching off as well', async () => {
  const model = await supply({ effort: 'low' });
  const sent = captureSend(model);
  await model.invoke(MESSAGES);
  assert.deepEqual(sent[0].additionalModelRequestFields, { output_config: { effort: 'low' } });
});

test('without the new options the request is unchanged from upstream', async () => {
  const model = await supply({ enablePromptCaching: true, cacheSystemPrompt: true });
  const sent = captureSend(model);
  await model.invoke(MESSAGES);
  assert.equal(sent[0].additionalModelRequestFields, undefined);
  const handlerConfig = await model.client.config.requestHandler.configProvider;
  assert.ok(!handlerConfig?.requestTimeout, 'no request timeout should be configured');
});

test('the options appear in the node UI', () => {
  const node = new LmChatAwsBedrockAdvanced();
  const opts = node.description.properties.find((p) => p.name === 'options').options;
  const effort = opts.find((o) => o.name === 'effort');
  assert.ok(effort, 'effort option missing');
  assert.deepEqual(
    effort.options.map((o) => o.value),
    ['low', 'medium', 'high', 'xhigh', 'max'],
  );
  assert.ok(opts.find((o) => o.name === 'timeout'), 'timeout option missing');
});

test('timeout fails a request that never answers', async () => {
  const server = http.createServer(() => {}); // accept, never respond
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const model = await supply({ enablePromptCaching: true, timeout: 300 });
    const handler = model.client.config.requestHandler;
    const started = Date.now();
    await assert.rejects(
      handler.handle({
        protocol: 'http:',
        hostname: '127.0.0.1',
        port,
        method: 'POST',
        path: '/model/test/converse',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      (err) => err.name === 'TimeoutError',
    );
    assert.ok(Date.now() - started < 5000, 'timed out too slowly');
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
