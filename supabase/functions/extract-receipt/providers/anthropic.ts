export async function callAnthropic(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('ANTHROPIC_AUTH_TOKEN');
  if (!apiKey) throw new Error('ANTHROPIC_AUTH_TOKEN not set');

  const baseUrl = Deno.env.get('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com/v1';
  const url = `${baseUrl.replace(/\/$/, '')}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: imageBase64,
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '{}';
  return JSON.parse(text);
}
