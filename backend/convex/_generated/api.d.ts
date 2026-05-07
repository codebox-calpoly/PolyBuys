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
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as blocks from "../blocks.js";
import type * as http from "../http.js";
import type * as lib_authIdentity from "../lib/authIdentity.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_reportedConversationListings from "../lib/reportedConversationListings.js";
import type * as lib_runtimeConfig from "../lib/runtimeConfig.js";
import type * as lib_storageImageValidation from "../lib/storageImageValidation.js";
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
  admin: typeof admin;
  auth: typeof auth;
  blocks: typeof blocks;
  http: typeof http;
  "lib/authIdentity": typeof lib_authIdentity;
  "lib/logger": typeof lib_logger;
  "lib/reportedConversationListings": typeof lib_reportedConversationListings;
  "lib/runtimeConfig": typeof lib_runtimeConfig;
  "lib/storageImageValidation": typeof lib_storageImageValidation;
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
  pushNotifications: {
    public: {
      deleteNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      getNotification: FunctionReference<
        "query",
        "internal",
        { id: string; logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        null | {
          _contentAvailable?: boolean;
          _creationTime: number;
          badge?: number;
          body?: string;
          categoryId?: string;
          channelId?: string;
          data?: any;
          expiration?: number;
          interruptionLevel?:
            | "active"
            | "critical"
            | "passive"
            | "time-sensitive";
          mutableContent?: boolean;
          numPreviousFailures: number;
          priority?: "default" | "normal" | "high";
          sound?: string | null;
          state:
            | "awaiting_delivery"
            | "in_progress"
            | "delivered"
            | "needs_retry"
            | "failed"
            | "maybe_delivered"
            | "unable_to_deliver";
          subtitle?: string;
          title?: string;
          ttl?: number;
        }
      >;
      getNotificationsForUser: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          userId: string;
        },
        Array<{
          _contentAvailable?: boolean;
          _creationTime: number;
          badge?: number;
          body?: string;
          categoryId?: string;
          channelId?: string;
          data?: any;
          expiration?: number;
          id: string;
          interruptionLevel?:
            | "active"
            | "critical"
            | "passive"
            | "time-sensitive";
          mutableContent?: boolean;
          numPreviousFailures: number;
          priority?: "default" | "normal" | "high";
          sound?: string | null;
          state:
            | "awaiting_delivery"
            | "in_progress"
            | "delivered"
            | "needs_retry"
            | "failed"
            | "maybe_delivered"
            | "unable_to_deliver";
          subtitle?: string;
          title?: string;
          ttl?: number;
        }>
      >;
      getStatusForUser: FunctionReference<
        "query",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        { hasToken: boolean; paused: boolean }
      >;
      pauseNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      recordPushNotificationToken: FunctionReference<
        "mutation",
        "internal",
        {
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          pushToken: string;
          userId: string;
        },
        null
      >;
      removePushNotificationToken: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      restart: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        boolean
      >;
      sendPushNotification: FunctionReference<
        "mutation",
        "internal",
        {
          allowUnregisteredTokens?: boolean;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          notification: {
            _contentAvailable?: boolean;
            badge?: number;
            body?: string;
            categoryId?: string;
            channelId?: string;
            data?: any;
            expiration?: number;
            interruptionLevel?:
              | "active"
              | "critical"
              | "passive"
              | "time-sensitive";
            mutableContent?: boolean;
            priority?: "default" | "normal" | "high";
            sound?: string | null;
            subtitle?: string;
            title?: string;
            ttl?: number;
          };
          userId: string;
        },
        string | null
      >;
      sendPushNotificationBatch: FunctionReference<
        "mutation",
        "internal",
        {
          allowUnregisteredTokens?: boolean;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          notifications: Array<{
            notification: {
              _contentAvailable?: boolean;
              badge?: number;
              body?: string;
              categoryId?: string;
              channelId?: string;
              data?: any;
              expiration?: number;
              interruptionLevel?:
                | "active"
                | "critical"
                | "passive"
                | "time-sensitive";
              mutableContent?: boolean;
              priority?: "default" | "normal" | "high";
              sound?: string | null;
              subtitle?: string;
              title?: string;
              ttl?: number;
            };
            userId: string;
          }>;
        },
        Array<string | null>
      >;
      shutdown: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        { data?: any; message: string }
      >;
      unpauseNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
    };
  };
};
