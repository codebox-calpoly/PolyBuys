/* eslint-disable @typescript-eslint/no-explicit-any */

import { convexTest } from 'convex-test';
import schema from '../schema';
import { api } from '../_generated/api';
import * as supportReportsModule from '../supportReports';
import * as apiModule from '../_generated/api';
import * as serverModule from '../_generated/server';
import { SUPPORT_REPORT_DESCRIPTION_MAX } from '@polybuys/shared';

const modules = {
  '../supportReports.ts': () => Promise.resolve(supportReportsModule),
  '../_generated/api.ts': () => Promise.resolve(apiModule),
  '../_generated/server.ts': () => Promise.resolve(serverModule),
} as any;

function asReporter(t: any) {
  return t.withIdentity({
    name: 'Reporter',
    subject: 'reporter-stable-id',
    email: 'REPORTER@calpoly.edu',
  });
}

describe('Support report mutations', () => {
  it('submitSupportReport creates a durable support report with user and app context', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = asReporter(t);

    const result = await asUser.mutation(api.supportReports.submitSupportReport, {
      category: 'bug',
      description: 'The inbox spinner never goes away.',
      context: {
        platform: 'ios',
        appVersion: '1.0.0',
        osVersion: '17.6',
        route: '/account-settings',
      },
    });

    const report = await t.run(async (ctx: any) => {
      return await ctx.db.get(result.supportReportId);
    });

    expect(report).toMatchObject({
      reporterId: 'reporter-stable-id',
      reporterEmail: 'reporter@calpoly.edu',
      category: 'bug',
      description: 'The inbox spinner never goes away.',
      context: {
        platform: 'ios',
        appVersion: '1.0.0',
        osVersion: '17.6',
        route: '/account-settings',
      },
    });
    expect(typeof report?.createdAt).toBe('number');
  });

  it('submitSupportReport requires authentication', async () => {
    const t = convexTest(schema as any, modules);

    await expect(async () => {
      await t.mutation(api.supportReports.submitSupportReport, {
        category: 'other',
        description: 'I need help with my account.',
      });
    }).rejects.toThrow('You must be logged in to report a problem');
  });

  it('submitSupportReport rejects empty or too-long descriptions', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = asReporter(t);

    await expect(async () => {
      await asUser.mutation(api.supportReports.submitSupportReport, {
        category: 'other',
        description: '   ',
      });
    }).rejects.toThrow('Description is required');

    await expect(async () => {
      await asUser.mutation(api.supportReports.submitSupportReport, {
        category: 'bug',
        description: 'a'.repeat(SUPPORT_REPORT_DESCRIPTION_MAX + 1),
      });
    }).rejects.toThrow(`Description must be ${SUPPORT_REPORT_DESCRIPTION_MAX} characters or less`);
  });

  it('submitSupportReport blocks duplicate rapid submissions', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = asReporter(t);
    const payload = {
      category: 'messages' as const,
      description: 'Messages are not sending.',
    };

    await asUser.mutation(api.supportReports.submitSupportReport, payload);

    await expect(async () => {
      await asUser.mutation(api.supportReports.submitSupportReport, payload);
    }).rejects.toThrow('You already submitted this problem recently.');
  });

  it('submitSupportReport rate limits rapid support reports', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = asReporter(t);

    for (let i = 0; i < 3; i++) {
      await asUser.mutation(api.supportReports.submitSupportReport, {
        category: 'bug',
        description: `Distinct bug report ${i}`,
      });
    }

    await expect(async () => {
      await asUser.mutation(api.supportReports.submitSupportReport, {
        category: 'listing',
        description: 'Another issue after several quick reports.',
      });
    }).rejects.toThrow('Support report limit reached. Please try again later.');
  });
});
