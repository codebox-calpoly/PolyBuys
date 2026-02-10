import { httpRouter } from 'convex/server';
// Auth import removed - using custom OTP auth in otpAuth.ts
// import { auth } from './auth';

const http = httpRouter();

// auth.addHttpRoutes(http) removed - custom OTP auth doesn't use HTTP routes

export default http;
