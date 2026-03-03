import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Drain shadow moderation retries continuously so fail-open degradations self-heal
// once the moderation provider recovers.
crons.interval(
  'drain shadow moderation queue',
  { minutes: 2 },
  internal.moderation.processShadowModerationQueue,
  { limit: 50 }
);

export default crons;
