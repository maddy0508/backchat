const DEFAULT_MODEL = 'gemini-2.5-flash';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    analysis: {
      type: 'OBJECT',
      properties: {
        threat_level: {
          type: 'STRING',
          description: 'Exactly one of: none, low, medium, high'
        },
        assessment: {
          type: 'STRING',
          description: 'One concise sentence describing the conversation dynamics.'
        },
        tactics_detected: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              evidence: { type: 'STRING' },
              severity: {
                type: 'STRING',
                description: 'Exactly one of: low, medium, high'
              }
            },
            required: ['name', 'evidence', 'severity']
          }
        }
      },
      required: ['threat_level', 'assessment', 'tactics_detected']
    },
    suggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          tactic: { type: 'STRING' },
          subtext: { type: 'STRING' },
          tone: {
            type: 'STRING',
            description: 'Exactly one of: calm, firm, strategic, de-escalating, direct'
          }
        },
        required: ['text', 'tactic', 'subtext', 'tone']
      }
    }
  },
  required: ['analysis', 'suggestions']
};

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }

  return {};
}

function safeParseModelText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normalisePayload(payload) {
  const analysis = payload?.analysis || {};
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];

  const threat = String(analysis.threat_level || 'none').toLowerCase();
  const allowedThreats = new Set(['none', 'low', 'medium', 'high']);

  return {
    analysis: {
      threat_level: allowedThreats.has(threat) ? threat : 'none',
      assessment: String(analysis.assessment || 'No clear psychological pressure pattern is evidenced yet.'),
      tactics_detected: Array.isArray(analysis.tactics_detected)
        ? analysis.tactics_detected
            .filter((item) => item && typeof item === 'object')
            .slice(0, 6)
            .map((item) => ({
              name: String(item.name || 'Unspecified tactic'),
              evidence: String(item.evidence || 'Evidence not specified.'),
              severity: ['low', 'medium', 'high'].includes(String(item.severity || '').toLowerCase())
                ? String(item.severity).toLowerCase()
                : 'low'
            }))
        : []
    },
    suggestions: suggestions
      .filter((item) => item && typeof item === 'object')
      .slice(0, 4)
      .map((item) => ({
        text: String(item.text || ''),
        tactic: String(item.tactic || 'Strategic response'),
        subtext: String(item.subtext || ''),
        tone: String(item.tone || 'strategic')
      }))
      .filter((item) => item.text.trim().length > 0)
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY environment variable.' });
  }

  let body;
  try {
    body = readJsonBody(req);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON request body.' });
  }

  const context = typeof body.context === 'string' ? body.context.trim() : '';
  const system = typeof body.system === 'string' ? body.system.trim() : '';
  const mode = typeof body.mode === 'string' ? body.mode.trim() : 'conversation';

  if (!context) {
    return res.status(400).json({ error: 'Missing conversation context.' });
  }

  if (!system) {
    return res.status(400).json({ error: 'Missing mode system instructions.' });
  }

  const prompt = [
    `MODE: ${mode}`,
    'LIVE CONVERSATION TRANSCRIPT:',
    context,
    '',
    'Return fresh live analysis only. Suggestions must be exact words the user can say now.',
    'Do not invent evidence. Only flag tactics clearly supported by transcript wording or behaviour.',
    'Prioritise calm, assertive, legally/socially safe responses. Do not suggest threats, deception, harassment, coercion, or manipulation.'
  ].join('\n');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: {
            temperature: 0.45,
            topP: 0.9,
            maxOutputTokens: 1400,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Gemini API request failed.',
        details: data?.error?.message || 'Unknown API error.'
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = safeParseModelText(text);

    if (!parsed) {
      return res.status(502).json({ error: 'Gemini returned an unreadable response.' });
    }

    return res.status(200).json(normalisePayload(parsed));
  } catch (error) {
    return res.status(500).json({
      error: 'Generation failed.',
      details: error instanceof Error ? error.message : 'Unknown server error.'
    });
  }
}
