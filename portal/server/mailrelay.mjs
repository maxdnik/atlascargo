// Server only. Never include this module in the browser bundle.
const api = 'https://atlas-cargo-logistics.ipzmarketing.com/api/v1/';
const campaignId = 3;
const pageSize = 100;

function isContactLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['atlas-cargo-logistics.com', 'www.atlas-cargo-logistics.com'].includes(url.hostname) &&
      url.pathname === '/' && url.hash === '#contacto';
  } catch {
    return false;
  }
}

export async function readCampaign({ apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('Falta configurar MAILRELAY_API_KEY en el servidor.');
  async function get(path, params = {}) {
    const url = new URL('sent_campaigns/' + campaignId + path, api);
    url.search = new URLSearchParams(params).toString();
    const response = await fetchImpl(url, {
      headers: { 'X-AUTH-TOKEN': apiKey, Accept: 'application/json' },
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Mailrelay respondió con estado ' + response.status);
    return response.json();
  }

  const summary = await get('');
  if (summary.id !== campaignId) throw new Error('La respuesta no corresponde a la campaña de Atlas.');
  const recipients = new Map();
  for (let page = 1; ; page++) {
    const rows = await get('/sent_emails', { page, per_page: pageSize, 'q[s]': 'id asc',
      include_clicks: true, include_unsubscribe_events: true, include_impressions: true });
    if (!Array.isArray(rows)) throw new Error('Formato inesperado de destinatarios.');
    if (!rows.length) break;
    const before = recipients.size;
    for (const row of rows) {
      if (!row.id || !row.email || ![row.clicks, row.unsubscribe_events, row.impressions].every(Array.isArray)) {
        throw new Error('Mailrelay devolvió un registro incompleto.');
      }
      const cta = row.clicks.filter(click => isContactLink(click.tracked_url?.url));
      recipients.set(row.id, {
        id: row.id, email: row.email.trim().toLowerCase(), subscriberId: row.subscriber_id,
        status: row.status, deliveredAt: row.delivered_at, opened: row.impressions.length > 0,
        unsubscribed: row.unsubscribe_events.length > 0, contactClicks: cta.length,
        lastContactClick: cta.map(click => click.created_at).sort().at(-1) ?? null,
      });
    }
    if (recipients.size === before) throw new Error('Mailrelay repitió la página de destinatarios.');
  }
  return {
    id: campaignId, subject: summary.subject, sent: summary.sent_emails_count,
    delivered: summary.delivered_emails_count, bounced: summary.bounced_emails_count,
    softBounced: summary.soft_bounced_emails_count, opened: summary.unique_impressions_count,
    unsubscribes: summary.unsubscribe_events_count, recipients: [...recipients.values()],
    refreshedAt: new Date().toISOString(),
  };
}

// Instantiate once per Atlas server process. On refresh failure retain the last
// complete snapshot with its original timestamp; do not cache partial pages.
export function createCampaignReader(options) {
  let snapshot;
  let expiresAt = 0;
  let pending;
  return async function read() {
    if (snapshot && Date.now() < expiresAt) return snapshot;
    if (!pending) {
      pending = readCampaign(options).then(result => {
        snapshot = result;
        expiresAt = Date.now() + 15 * 60_000;
        return result;
      }).catch(error => {
        if (!snapshot) throw error;
        return { ...snapshot, stale: true };
      }).finally(() => { pending = undefined; });
    }
    return pending;
  };
}
