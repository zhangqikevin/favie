const LITELLM_URL   = "https://litellm.vllm.yesy.dev/v1/chat/completions";
const LITELLM_MODEL = "claude-sonnet-4-6";

export async function callLiteLLM(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxTokens = 2048,
): Promise<string> {
  const apiKey = process.env.MOONSHOT_API_KEY ?? "";
  const res = await fetch(LITELLM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: LITELLM_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LiteLLM error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}
