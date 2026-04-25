async function loadStatus() {
  const response = await fetch('/api/status');
  const data = await response.json();
  document.querySelector('#status').textContent = `Status WhatsApp: ${data.whatsapp.status} (${data.whatsapp.mode})`;
  document.querySelector('#metrics').innerHTML = `
    <strong>Métricas:</strong>
    <div>Total conversas: ${data.metrics.totalConversations}</div>
    <div>Em aberto: ${data.metrics.openConversations}</div>
    <div>Necessita humano: ${data.metrics.humanRequiredConversations}</div>
  `;
}

document.querySelector('#connect').addEventListener('click', async () => {
  await fetch('/api/whatsapp/connect', { method: 'POST' });
  await loadStatus();
});

document.querySelector('#scan').addEventListener('click', async () => {
  await fetch('/api/whatsapp/confirm-scan', { method: 'POST' });
  await loadStatus();
});

loadStatus();
