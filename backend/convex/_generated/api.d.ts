/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as AppReviewOTP from "../AppReviewOTP.js";
import type * as ResendOTP from "../ResendOTP.js";
import type * as __tests___testUtils from "../__tests__/testUtils.js";
import type * as auth from "../auth.js";
import type * as blocks from "../blocks.js";
import type * as http from "../http.js";
import type * as lib_authIdentity from "../lib/authIdentity.js";
import type * as listings from "../listings.js";
import type * as messages from "../messages.js";
import type * as moderation from "../moderation.js";
import type * as profiles from "../profiles.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as reports from "../reports.js";
import type * as savedListings from "../savedListings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  AppReviewOTP: typeof AppReviewOTP;
  ResendOTP: typeof ResendOTP;
  "__tests__/testUtils": typeof __tests___testUtils;
  auth: typeof auth;
  blocks: typeof blocks;
  http: typeof http;
  "lib/authIdentity": typeof lib_authIdentity;
  listings: typeof listings;
  messages: typeof messages;
  moderation: typeof moderation;
  profiles: typeof profiles;
  pushNotifications: typeof pushNotifications;
  reports: typeof reports;
  savedListings: typeof savedListings;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  pushNotifications: import("@convex-dev/expo-push-notifications/_generated/component.js").ComponentApi<"pushNotifications">;
};
