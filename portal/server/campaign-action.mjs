// Mount this action behind the production portal's server-side session lookup.
// authorizeCommercial must apply the same tenant and role checks as its CRM.
import { createCampaignReader } from './mailrelay.mjs';

export function createCampaignAction({ authorizeCommercial, read = createCampaignReader({
  apiKey: process.env.MAILRELAY_API_KEY,
}) }) {
  if (typeof authorizeCommercial !== 'function') throw new Error('Falta la autorización comercial del portal.');
  return async function handle(request) {
    const headers = { 'Cache-Control': 'private, no-store' };
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET' } });
    if (!(await authorizeCommercial(request))) {
      return Response.json({ error: 'Acceso denegado.' }, { status: 403, headers });
    }
    try {
      const { recipients, ...summary } = await read();
      return Response.json({ ...summary, recipients: recipients.filter(row => row.contactClicks > 0) }, { headers });
    } catch {
      return Response.json({ error: 'No se pudieron obtener los resultados de Mailrelay.' }, { status: 503, headers });
    }
  };
}
