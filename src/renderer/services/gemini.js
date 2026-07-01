const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = 'gemini-2.0-flash'

export async function generateContent(apiKey, contents, systemInstruction = null) {
  const effectiveContents = contents.length === 0
    ? [{ role: 'user', parts: [{ text: 'Start.' }] }]
    : contents

  const body = {
    contents: effectiveContents,
    generationConfig: { temperature: 0.9, maxOutputTokens: 400 },
  }
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] }
  }

  const res = await fetch(
    `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `HTTP ${res.status}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function correctGrammar(apiKey, text) {
  const prompt = `You are an English grammar teacher for Korean learners.

User's sentence: "${text}"

Respond in exactly this format (use Korean for explanations):

**교정된 문장:**
[corrected sentence — if no errors, write the original with "완벽해요!"]

**수정 내용:**
[each correction explained briefly in Korean — if none, write "문법 오류 없음 👍"]

**좋았던 점:**
[one short encouraging comment in Korean]`

  return generateContent(apiKey, [{ role: 'user', parts: [{ text: prompt }] }])
}
