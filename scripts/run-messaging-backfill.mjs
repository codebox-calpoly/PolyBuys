import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');
const passthroughArgs = process.argv.slice(2);

const parsedBatchSize = Number.parseInt(
  process.env.MESSAGING_BACKFILL_BATCH_SIZE ?? '100',
  10
);
const batchSize = Number.isNaN(parsedBatchSize) ? 100 : parsedBatchSize;

function parseConvexRunResult(stdout) {
  const trimmedOutput = stdout.trim();
  const firstBraceIndex = trimmedOutput.indexOf('{');
  const lastBraceIndex = trimmedOutput.lastIndexOf('}');

  if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    throw new Error(`Unable to parse Convex run output:\n${trimmedOutput}`);
  }

  const jsonText = trimmedOutput.slice(firstBraceIndex, lastBraceIndex + 1);
  return JSON.parse(jsonText);
}

function runBackfillBatch(target, cursor) {
  const payload = JSON.stringify({
    ...(target === 'conversations'
      ? { conversationPagination: { numItems: batchSize, cursor } }
      : { messagePagination: { numItems: batchSize, cursor } }),
  });

  const stdout = execFileSync(
    'npx',
    [
      'convex',
      'run',
      ...passthroughArgs,
      '--typecheck',
      'disable',
      '--codegen',
      'disable',
      'messages:backfillMessagingFieldsBatch',
      payload,
    ],
    {
      cwd: backendDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }
  );

  return parseConvexRunResult(stdout);
}

let conversationCursor = null;
let messageCursor = null;
let totalConversationPatches = 0;
let totalMessagePatches = 0;
let iteration = 0;

while (conversationCursor !== false || messageCursor !== false) {
  iteration += 1;
  let conversationResult = null;
  let messageResult = null;

  if (conversationCursor !== false) {
    conversationResult = runBackfillBatch('conversations', conversationCursor);
    totalConversationPatches += conversationResult.conversationPatches ?? 0;
    conversationCursor = conversationResult.isDone
      ? false
      : conversationResult.conversationContinueCursor;
  }

  if (messageCursor !== false) {
    messageResult = runBackfillBatch('messages', messageCursor);
    totalMessagePatches += messageResult.messagePatches ?? 0;
    messageCursor = messageResult.isDone ? false : messageResult.messageContinueCursor;
  }

  console.log(
    JSON.stringify(
      {
        iteration,
        conversationPatches: conversationResult?.conversationPatches ?? 0,
        messagePatches: messageResult?.messagePatches ?? 0,
        conversationScanned: conversationResult?.conversationScanned ?? 0,
        messageScanned: messageResult?.messageScanned ?? 0,
        isDone: conversationCursor === false && messageCursor === false,
      },
      null,
      2
    )
  );
}

console.log(
  JSON.stringify(
    {
      totalConversationPatches,
      totalMessagePatches,
      batchSize,
      isDone: true,
    },
    null,
    2
  )
);
