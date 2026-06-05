// Uses OpenAI-compatible format — works with proxy routers (9router, LiteLLM, OpenRouter, etc.)
export async function callAnthropic(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('ANTHROPIC_AUTH_TOKEN');
  if (!apiKey) throw new Error('ANTHROPIC_AUTH_TOKEN not set');

  const baseUrl = Deno.env.get('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com/v1';
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: prompt },
        ],
      }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(text);
}
