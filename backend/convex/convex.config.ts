import { defineApp } from 'convex/server';
import pushNotifications from '@convex-dev/expo-push-notifications/convex.config.js';

const app: ReturnType<typeof defineApp> = defineApp();
app.use(pushNotifications);

export default app;
