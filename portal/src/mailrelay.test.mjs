import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignReader } from '../server/mailrelay.mjs';

test('paginated read, precise CTA, duplicate-safe refresh and concurrent readers', async () => {
  let calls = 0;
  const fetchImpl = async (url, init) => {
    calls++;
    assert.equal(init.headers['X-AUTH-TOKEN'], 'fixture');
    assert.equal(url.origin,'https://atlas-cargo-logistics.ipzmarketing.com');
    const row = {id:1,email:' Foo@Example.com ',status:'delivered', impressions:[{}],
      unsubscribe_events:[], clicks:['https://www.atlas-cargo-logistics.com/#contacto','https://instagram.com/#contacto',
      'https://atlas-cargo-logistics.com.ejemplo.org/#contacto'].map(url => ({tracked_url:{url},created_at:'2026-11-06'}))};
    const page = url.searchParams.get('page');
    return Response.json(!page ? {id:3} : page === '1' ? [row] : []);
  };
  const read = createCampaignReader({apiKey:'fixture',fetchImpl});
  const [a,b] = await Promise.all([read(),read()]);
  assert.equal(a,b);
  assert.equal(a.recipients[0].contactClicks,1);
  assert.equal(a.recipients[0].email,'foo@example.com');
  assert.equal(await read(),a);
  assert.equal(calls,3);
});

test('failed page does not leave a partial snapshot cached', async () => {
  let fail = true;
  const read = createCampaignReader({apiKey:'fixture',fetchImpl:async url =>
    url.searchParams.has('page') ? (fail ? new Response(null,{status:429}) : Response.json([])) : Response.json({id:3})});
  await assert.rejects(read(), /429/);
  fail = false;
  assert.deepEqual((await read()).recipients, []);
});

import { createCampaignAction } from '../server/campaign-action.mjs';

test('only an authorized commercial session can read the CTA contact list', async () => {
  let reads = 0;
  const read = async () => {
    reads++;
    return { id:3, recipients:[{id:1,contactClicks:0},{id:2,contactClicks:1}] };
  };
  const req = new Request('https://example.com');
  const denied = createCampaignAction({authorizeCommercial: async () => false, read});
  assert.equal((await denied(req)).status,403);
  assert.equal(reads,0);
  const allowed = createCampaignAction({authorizeCommercial: async () => true, read});
  const response = await allowed(req);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  assert.deepEqual((await response.json()).recipients,[{id:2,contactClicks:1}]);
});
