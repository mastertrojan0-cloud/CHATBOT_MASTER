export async function generateAssistantReply({ config, messages }) {
  if (!config.openaiApiKey) {
    const lastUserMessage = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    return `⚠️ OPENAI_API_KEY não configurada. Mensagem recebida: ${lastUserMessage}`;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? 'Sem resposta do modelo.';
}
