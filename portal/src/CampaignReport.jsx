import React from 'react';

export default function CampaignReport({ report, contacts = [] }) {
  const companies = new Map();
  for (const contact of contacts) {
    if (!contact.email || !contact.companyName) continue;
    const key = contact.email.trim().toLowerCase();
    const matches = companies.get(key) ?? new Set();
    matches.add(contact.companyName);
    companies.set(key, matches);
  }
  const interested = report.recipients.filter(row => row.contactClicks > 0)
    .sort((a, b) => (b.lastContactClick ?? '').localeCompare(a.lastContactClick ?? ''));
  return <section className="panel">
    <div className="panel-heading"><h2>{report.subject}</h2></div>
    <p>Actualizado el {new Date(report.refreshedAt).toLocaleString('es-AR', {timeZone:'America/Argentina/Buenos_Aires'})} (Argentina)</p>
    {report.stale && <p role="status">Falló la actualización. Se muestran los últimos resultados disponibles.</p>}
    <dl>{Object.entries({
      Enviados:report.sent, Entregados:report.delivered, Aperturas:report.opened,
      'Rebotes definitivos':report.bounced, 'Rebotes temporales':report.softBounced, Bajas:report.unsubscribes
    }).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>
    <h3>Clics en «Hablemos de tu próxima carga»</h3>
    {interested.length ? <table><thead><tr><th>Email</th><th>Empresa en CRM</th><th>Clics</th><th>Estado</th></tr></thead>
      <tbody>{interested.map(row => <tr key={row.id}><td>{row.email}</td>
        <td>{[...(companies.get(row.email) ?? [])].join(' / ') || 'Sin vincular'}</td>
        <td>{row.contactClicks}</td><td>{row.unsubscribed ? 'Baja de campaña' : row.status}</td></tr>)}</tbody></table>
      : <p>Todavía no hay clics registrados en el enlace de contacto.</p>}
  </section>;
}
