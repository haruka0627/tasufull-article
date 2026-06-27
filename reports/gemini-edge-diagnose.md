# Gemini Edge 診断レポート（別キー / 別プロジェクト調査）

実施: 2026-06-26T03:44:24.499Z

## 1. Supabase Secret と Edge キーの一致

- Supabase project: `ddojquacsyqesrjhcvmn`
- GEMINI_API_KEY digest (CLI): `b8980cd3c321d28c3b81ab3b0c6aa9282f38ec2e66c547791419157d0f57b9ab`
- Edge 上キーの SHA256: `b8980cd3c321d28c3b81ab3b0c6aa9282f38ec2e66c547791419157d0f57b9ab`
- **Edge vs Secret digest: MATCH**
- Edge fingerprint: `AIzaSyAB…78IY` (len 39)
- .env GEMINI_API_KEY: 未設定（ローカル digest 照合スキップ）

## 2. Edge Function が参照するプロジェクト

- **Supabase project ref:** `ddojquacsyqesrjhcvmn`
- Supabase URL: `https://ddojquacsyqesrjhcvmn.supabase.co`
- GOOGLE_CLOUD_PROJECT env on Edge: `not set`
- Google Cloud project ID は Edge 環境変数には設定されていません（API キーに紐づく GCP プロジェクトは Google 側で解決）

## 3. Google API プローブ（生レスポンス）

### generateContent_ping

- HTTP: 200
- URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=***REDACTED***`
- Headers:
```json
{
  "alt-svc": "h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000",
  "content-type": "application/json; charset=UTF-8",
  "date": "Fri, 26 Jun 2026 03:44:17 GMT",
  "server": "scaffolding on HTTPServer2",
  "server-timing": "gfet4t7; dur=911",
  "vary": "Origin, X-Origin, Referer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "x-gemini-service-tier": "standard",
  "x-xss-protection": "0"
}
```
- Body:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Pong!\n\n(How can I help you today? Are you just saying hello, or is there something specific you'd like to discuss or ask?)"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 2,
    "candidatesTokenCount": 31,
    "totalTokenCount": 33,
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 2
      }
    ],
    "serviceTier": "standard"
  },
  "modelVersion": "gemini-2.5-flash",
  "responseId": "kfU9arzYAZzD0-kPoLml-QI"
}
```

### models_list

- HTTP: 200
- URL: `https://generativelanguage.googleapis.com/v1beta/models?key=***REDACTED***`
- Headers:
```json
{
  "alt-svc": "h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000",
  "content-type": "application/json; charset=UTF-8",
  "date": "Fri, 26 Jun 2026 03:44:17 GMT",
  "server": "scaffolding on HTTPServer2",
  "server-timing": "gfet4t7; dur=114",
  "vary": "Origin, X-Origin, Referer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "x-xss-protection": "0"
}
```
- Body:
```json
{
  "models": [
    {
      "name": "models/gemini-2.5-flash",
      "version": "001",
      "displayName": "Gemini 2.5 Flash",
      "description": "Stable version of Gemini 2.5 Flash, our mid-size multimodal model that supports up to 1 million tokens, released in June of 2025.",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-pro",
      "version": "2.5",
      "displayName": "Gemini 2.5 Pro",
      "description": "Stable release (June 17th, 2025) of Gemini 2.5 Pro",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.0-flash",
      "version": "2.0",
      "displayName": "Gemini 2.0 Flash",
      "description": "Gemini 2.0 Flash",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.0-flash-001",
      "version": "2.0",
      "displayName": "Gemini 2.0 Flash 001",
      "description": "Stable version of Gemini 2.0 Flash, our fast and versatile multimodal model for scaling across diverse tasks, released in January of 2025.",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.0-flash-lite-001",
      "version": "2.0",
      "displayName": "Gemini 2.0 Flash-Lite 001",
      "description": "Stable version of Gemini 2.0 Flash-Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.0-flash-lite",
      "version": "2.0",
      "displayName": "Gemini 2.0 Flash-Lite",
      "description": "Gemini 2.0 Flash-Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.5-flash-preview-tts",
      "version": "gemini-2.5-flash-exp-tts-2025-05-19",
      "displayName": "Gemini 2.5 Flash Preview TTS",
      "description": "Gemini 2.5 Flash Preview TTS",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 16384,
      "supportedGenerationMethods": [
        "countTokens",
        "generateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.5-pro-preview-tts",
      "version": "gemini-2.5-pro-preview-tts-2025-05-19",
      "displayName": "Gemini 2.5 Pro Preview TTS",
      "description": "Gemini 2.5 Pro Preview TTS",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 16384,
      "supportedGenerationMethods": [
        "countTokens",
        "generateContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2
    },
    {
      "name": "models/gemma-4-26b-a4b-it",
      "version": "001",
      "displayName": "Gemma 4 26B A4B IT",
      "description": "Gemma 4 26B A4B IT",
      "inputTokenLimit": 262144,
      "outputTokenLimit": 32768,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemma-4-31b-it",
      "version": "001",
      "displayName": "Gemma 4 31B IT",
      "description": "Gemma 4 31B IT",
      "inputTokenLimit": 262144,
      "outputTokenLimit": 32768,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-flash-latest",
      "version": "Gemini Flash Latest",
      "displayName": "Gemini Flash Latest",
      "description": "Latest release of Gemini Flash",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-flash-lite-latest",
      "version": "Gemini Flash-Lite Latest",
      "displayName": "Gemini Flash-Lite Latest",
      "description": "Latest release of Gemini Flash-Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-pro-latest",
      "version": "Gemini Pro Latest",
      "displayName": "Gemini Pro Latest",
      "description": "Latest release of Gemini Pro",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-flash-lite",
      "version": "001",
      "displayName": "Gemini 2.5 Flash-Lite",
      "description": "Stable version of Gemini 2.5 Flash-Lite, released in July of 2025",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-flash-image",
      "version": "2.0",
      "displayName": "Nano Banana",
      "description": "Gemini 2.5 Flash Preview Image",
      "inputTokenLimit": 32768,
      "outputTokenLimit": 32768,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 1
    },
    {
      "name": "models/gemini-3-pro-preview",
      "version": "3-pro-preview-11-2025",
      "displayName": "Gemini 3 Pro Preview",
      "description": "Gemini 3 Pro Preview",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-3-flash-preview",
      "version": "3-flash-preview-12-2025",
      "displayName": "Gemini 3 Flash Preview",
      "description": "Gemini 3 Flash Preview",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-3.1-pro-preview",
      "version": "3.1-pro-preview-01-2026",
      "displayName": "Gemini 3.1 Pro Preview",
      "description": "Gemini 3.1 Pro Preview",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-3.1-pro-preview-customtools",
      "version": "3.1-pro-preview-01-2026",
      "displayName": "Gemini 3.1 Pro Preview Custom Tools",
      "description": "Gemini 3.1 Pro Preview optimized for custom tool usage",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-3.1-flash-lite-preview",
      "version": "3.1-flash-lite-preview-03-2026",
      "displayName": "Gemini 3.1 Flash Lite Preview",
      "description": "Gemini 3.1 Flash Lite Preview",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-3.1-flash-lite",
      "version": "3.1-flash-lite-05-2026",
      "displayName": "Gemini 3.1 Flash Lite",
      "description": "Gemini 3.1 Flash Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-3-pro-image-preview",
      "version": "3.0",
      "displayName": "Nano Banana Pro",
      "description": "Gemini 3 Pro Image Preview",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 32768,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 1,
      "thinking": true
    },
    {
      "name": "models/gemini-3-pro-image",
      "version": "3.0",
      "displayName": "Nano Banana Pro",
      "description": "Gemini 3 Pro Image",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 32768,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 1,
      "thinking": true
    },
    {
      "name": "models/nano-banana-pro-preview",
      "version": "3.0",
      "displayName": "Nano Banana Pro",
      "description": "Gemini 3 Pro Image Preview",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 32768,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 1,
      "thinking": true
    },
    {
      "name": "models/gemini-3.1-flash-image-preview",
      "version": "3.0",
      "displayName": "Nano Banana 2",
      "description": "Gemini 3.1 Flash Image Preview.",
      "inputTokenLimit": 65536,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 1,
      "thinking": true
    },
    {
      "name": "models/gemini-3.1-flash-image",
      "version": "3.0",
      "displayName": "Nano Banana 2",
      "description": "Gemini 3.1 Flash Image.",
      "inputTokenLimit": 65536,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 1,
      "thinking": true
    },
    {
      "name": "models/gemini-3.5-flash",
      "version": "3.5-flash-05-2026",
      "displayName": "Gemini 3.5 Flash",
      "description": "Gemini 3.5 Flash",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/lyria-3-clip-preview",
      "version": "lyria-3-clip-preview",
      "displayName": "Lyria 3 Clip Preview",
      "description": "Lyria 3 30s model Preview",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2
    },
    {
      "name": "models/lyria-3-pro-preview",
      "version": "lyria-3-pro-preview",
      "displayName": "Lyria 3 Pro Preview",
      "description": "Lyria 3 Pro Preview",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-3.1-flash-tts-preview",
      "version": "3.1-flash-tts-preview",
      "displayName": "Gemini 3.1 Flash TTS Preview",
      "description": "Gemini 3.1 Flash TTS Preview",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 16384,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-robotics-er-1.5-preview",
      "version": "1.5-preview",
      "displayName": "Gemini Robotics-ER 1.5 Preview",
      "description": "Gemini Robotics-ER 1.5 Preview",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-robotics-er-1.6-preview",
      "version": "1.6-preview",
      "displayName": "Gemini Robotics-ER 1.6 Preview",
      "description": "Gemini Robotics-ER 1.6 Preview",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-computer-use-preview-10-2025",
      "version": "Gemini 2.5 Computer Use Preview 10-2025",
      "displayName": "Gemini 2.5 Computer Use Preview 10-2025",
      "description": "Gemini 2.5 Computer Use Preview 10-2025",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/antigravity-preview-05-2026",
      "version": "0.1",
      "displayName": "Antigravity Agent Preview",
      "description": "Preview release of Antigravity Agent (05-2026)",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ]
    },
    {
      "name": "models/deep-research-max-preview-04-2026",
      "version": "deepthink-exp-05-20",
      "displayName": "Deep Research Max Preview (Apr-21-2026)",
      "description": "Preview release (April 21st, 2026) of Deep Research Max",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/deep-research-preview-04-2026",
      "version": "deepthink-exp-05-20",
      "displayName": "Deep Research Preview (Apr-21-2026)",
      "description": "Preview release (April 21th, 2026) of Deep Research",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/deep-research-pro-preview-12-2025",
      "version": "deepthink-exp-05-20",
      "displayName": "Deep Research Pro Preview (Dec-12-2025)",
      "description": "Preview release (December 12th, 2025) of Deep Research Pro",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-embedding-001",
      "version": "001",
      "displayName": "Gemini Embedding 001",
      "description": "Obtain a distributed representation of a text.",
      "inputTokenLimit": 2048,
      "outputTokenLimit": 1,
      "supportedGenerationMethods": [
        "embedContent",
        "countTextTokens",
        "countTokens",
        "asyncBatchEmbedContent"
      ]
    },
    {
      "name": "models/gemini-embedding-2-preview",
      "version": "2",
      "displayName": "Gemini Embedding 2 Preview",
      "description": "Obtain a distributed representation of multimodal content.",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 1,
      "supportedGenerationMethods": [
        "embedContent",
        "countTextTokens",
        "countTokens",
        "asyncBatchEmbedContent"
      ]
    },
    {
      "name": "models/gemini-embedding-2",
      "version": "2",
      "displayName": "Gemini Embedding 2",
      "description": "Obtain a distributed representation of multimodal content.",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 1,
      "supportedGenerationMethods": [
        "embedContent",
        "countTextTokens",
        "countTokens",
        "asyncBatchEmbedContent"
      ]
    },
    {
      "name": "models/aqa",
      "version": "001",
      "displayName": "Model that performs Attributed Question Answering.",
      "description": "Model trained to return answers to questions that are grounded in provided sources, along with estimating answerable probability.",
      "inputTokenLimit": 7168,
      "outputTokenLimit": 1024,
      "supportedGenerationMethods": [
        "generateAnswer"
      ],
      "temperature": 0.2,
      "topP": 1,
      "topK": 40
    },
    {
      "name": "models/imagen-4.0-generate-001",
      "version": "001",
      "displayName": "Imagen 4",
      "description": "Vertex served Imagen 4.0 model",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predict"
      ]
    },
    {
      "name": "models/imagen-4.0-ultra-generate-001",
      "version": "001",
      "displayName": "Imagen 4 Ultra",
      "description": "Vertex served Imagen 4.0 ultra model",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predict"
      ]
    },
    {
      "name": "models/imagen-4.0-fast-generate-001",
      "version": "001",
      "displayName": "Imagen 4 Fast",
      "description": "Vertex served Imagen 4.0 Fast model",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predict"
      ]
    },
    {
      "name": "models/veo-2.0-generate-001",
      "version": "2.0",
      "displayName": "Veo 2",
      "description": "Vertex served Veo 2 model. Access to this model requires billing to be enabled on the associated Google Cloud Platform account. Please visit https://console.cloud.google.com/billing to enable it.",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predictLongRunning"
      ]
    },
    {
      "name": "models/veo-3.0-generate-001",
      "version": "3.0",
      "displayName": "Veo 3",
      "description": "Veo 3",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predictLongRunning"
      ]
    },
    {
      "name": "models/veo-3.0-fast-generate-001",
      "version": "3.0",
      "displayName": "Veo 3 fast",
      "description": "Veo 3 fast",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predictLongRunning"
      ]
    },
    {
      "name": "models/veo-3.1-generate-preview",
      "version": "3.1",
      "displayName": "Veo 3.1",
      "description": "Veo 3.1",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predictLongRunning"
      ]
    },
    {
      "name": "models/veo-3.1-fast-generate-preview",
      "version": "3.1",
      "displayName": "Veo 3.1 fast",
      "description": "Veo 3.1 fast",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predictLongRunning"
      ]
    },
    {
      "name": "models/veo-3.1-lite-generate-preview",
      "version": "3.1",
      "displayName": "Veo 3.1 lite",
      "description": "Veo 3.1 lite",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predictLongRunning"
      ]
    }
  ],
  "nextPageToken": "CiRtb2RlbHMvdmVvLTMuMS1saXRlLWdlbmVyYXRlLXByZXZpZXc="
}
```

### model_get_gemini-2.5-flash

- HTTP: 200
- URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=***REDACTED***`
- Headers:
```json
{
  "alt-svc": "h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000",
  "content-type": "application/json; charset=UTF-8",
  "date": "Fri, 26 Jun 2026 03:44:18 GMT",
  "server": "scaffolding on HTTPServer2",
  "server-timing": "gfet4t7; dur=74",
  "vary": "Origin, X-Origin, Referer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "x-xss-protection": "0"
}
```
- Body:
```json
{
  "name": "models/gemini-2.5-flash",
  "version": "001",
  "displayName": "Gemini 2.5 Flash",
  "description": "Stable version of Gemini 2.5 Flash, our mid-size multimodal model that supports up to 1 million tokens, released in June of 2025.",
  "inputTokenLimit": 1048576,
  "outputTokenLimit": 65536,
  "supportedGenerationMethods": [
    "generateContent",
    "countTokens",
    "createCachedContent",
    "batchGenerateContent"
  ],
  "temperature": 1,
  "topP": 0.95,
  "topK": 64,
  "maxTemperature": 2,
  "thinking": true
}
```

### generateContent_header_auth

- HTTP: 200
- URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- Headers:
```json
{
  "alt-svc": "h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000",
  "content-type": "application/json; charset=UTF-8",
  "date": "Fri, 26 Jun 2026 03:44:18 GMT",
  "server": "scaffolding on HTTPServer2",
  "server-timing": "gfet4t7; dur=743",
  "vary": "Origin, X-Origin, Referer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "x-gemini-service-tier": "standard",
  "x-xss-protection": "0"
}
```
- Body:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Pong!\n\nHow can I help you today?"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 2,
    "candidatesTokenCount": 10,
    "totalTokenCount": 12,
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 2
      }
    ],
    "serviceTier": "standard"
  },
  "modelVersion": "gemini-2.5-flash",
  "responseId": "kvU9auqbCdCf0-kPvcfluQE"
}
```


## 4. gemini-chat 応答（問い合わせ文）

- HTTP: 200

```json
{
  "reply": "草刈り業者への問い合わせ文案を作成します。以下の情報を【】内に追記・修正してご活用ください。\n\n---\n\n**件名：草刈り作業のお見積もり依頼（【氏名または会社名】）**\n\n【草刈り業者名】御担当者様\n\nいつもお世話になっております。\nまたは\n初めてご連絡させていただきます。【氏名または会社名】と申します。\n\n所有する土地の草刈り作業について、お見積もりをお願いしたくご連絡いたしました。\n\n下記に詳細を記載いたしますので、ご確認いただけますでしょうか。\n\n**1. 作業場所**\n*   住所：〒【郵便番号】 【都道府県】【市区町村】【番地】【建物名・部屋番号など】\n*   Google マップのURL（もしあれば）：【URL】\n\n**2. 敷地の状況**\n*   広さ：約【〇〇】平方メートル（または【〇〇】坪）\n*   現在の草の高さ：【例：膝丈程度、胸丈程度、まばらに生えている、全体的に密生している】\n*   敷地の傾斜：【例：平坦、緩やかな傾斜、急な傾斜、段差あり】\n*   主な障害物：【例：庭木、石、フェンス、物置、ゴミ、その他（具体的に）】\n*   作業箇所の写真（もしあれば、添付ファイルをご確認ください）\n\n**3. 作業内容**\n*   草刈り（刈り払い機による作業）：【はい／いいえ】\n*   集草・処分：【はい／いいえ】\n*   除草剤散布：【はい／いいえ】\n*   その他ご要望：【例：木の剪定、低木の伐採、特定の範囲のみ作業希望など】\n\n**4. 希望作業時期**\n*   【〇月上旬／中旬／下旬】頃\n*   または【〇月〇日～〇月〇日】の間\n*   または【特に希望なし、貴社のご都合に合わせます】\n\n**5. 立ち会い希望の有無**\n*   お見積もり時の現地立ち会い：【希望する／希望しない】\n*   作業当日の立ち会い：【希望する／希望しない】\n\n**6. ご連絡先**\n*   お名前：【氏名】\n*   電話番号：【電話番号】\n*   メールアドレス：【メールアドレス】\n\nお忙しいところ恐縮ですが、お見積もりと作業可能な時期についてご連絡いただけますと幸いです。\nご不明な点がございましたら、お気軽にお申し付けください。\n\nどうぞよろしくお願いいたします。\n\n---",
  "usedGemini": true,
  "retryCount": 0,
  "intent": "work"
}
```

## 切り分け

- Secret と Edge キーは同一。別キー参照は **否定的**。
- Google 429 の `prepayment credits depleted` は、このキーに紐づく **Google 側プロジェクトの API 課金状態**の応答。Studio UI の残高表示と API が参照する課金枠が異なる可能性は残る。
