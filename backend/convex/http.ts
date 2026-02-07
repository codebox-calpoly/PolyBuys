import { httpRouter } from 'convex/server';
import { auth } from './auth';

const http = httpRouter();

// Add Convex Auth HTTP routes for email verification links, etc.
auth.addHttpRoutes(http);

export default http;
