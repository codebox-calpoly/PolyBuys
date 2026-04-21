import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { auth } from './auth';
import { getDeploymentReadiness } from './lib/runtimeConfig';

const http = httpRouter();

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

http.route({
  path: '/healthz',
  method: 'GET',
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        status: 'ok',
        service: 'polybuys-convex',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: jsonHeaders,
      }
    );
  }),
});

http.route({
  path: '/readyz',
  method: 'GET',
  handler: httpAction(async () => {
    const readiness = getDeploymentReadiness();

    return new Response(JSON.stringify(readiness), {
      status: readiness.status === 'ready' ? 200 : 503,
      headers: jsonHeaders,
    });
  }),
});

auth.addHttpRoutes(http);

export default http;
