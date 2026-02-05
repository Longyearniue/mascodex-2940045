// AI-powered creative script generator for sales letters

export interface CompanyContext {
  companyName: string;
  businessType: string;
  location: string;
  philosophy: string;
  uniqueStrengths: string[];
  keywords: string[];
}

export interface GeneratedScript {
  historicalNarrative: string;
  historicalFigure: string;
  attraction: string;
}

const CM_DIRECTOR_PROMPT = `あなたはCMディレクターで広報を担当しています。これはCMです。

この会社の特徴と顧客に一番アピールすべき部分を端的に表現したいです。
歴史の人物がしゃべる面白くてユニークな他社とは違うセリフを考えて考えて考え抜いて面白いセリフを考えてください。

以下の形式でJSON形式で回答してください：
{
  "historicalFigure": "歴史上の人物名（例：織田信長、坂本龍馬など）",
  "historicalNarrative": "その人物が語るセリフ（「」で囲んだ形式）",
  "attraction": "会社の魅力を一文で表現"
}

重要なルール：
- 歴史上の人物のキャラクターを活かした独特の語り口にする
- 会社の具体的な特徴や強みを織り込む
- 面白くてインパクトのあるセリフにする
- 広告っぽくならない自然な表現にする
- JSONのみを出力し、他の説明は不要`;

export async function generateCreativeScript(
  ai: any,
  context: CompanyContext
): Promise<GeneratedScript | null> {
  try {
    const companyInfo = `
会社名: ${context.companyName}
業種: ${context.businessType}
所在地: ${context.location}
理念・哲学: ${context.philosophy || '情報なし'}
強み・特徴: ${context.uniqueStrengths?.join('、') || '情報なし'}
キーワード: ${context.keywords?.join('、') || '情報なし'}
`;

    const messages = [
      {
        role: 'user',
        content: `${CM_DIRECTOR_PROMPT}\n\n【会社情報】\n${companyInfo}`
      }
    ];

    console.log('[AI] Generating creative script for:', context.companyName);

    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages,
      max_tokens: 1024,
      temperature: 0.8, // Higher temperature for creativity
    });

    if (!response || !response.response) {
      console.log('[AI] No response from AI');
      return null;
    }

    const responseText = response.response;
    console.log('[AI] Raw response:', responseText.substring(0, 200));

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[AI] Could not extract JSON from response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate the response
    if (!parsed.historicalNarrative || !parsed.historicalFigure) {
      console.log('[AI] Invalid response structure');
      return null;
    }

    // Validate that the response doesn't contain junk
    if (containsInvalidContent(parsed.historicalNarrative)) {
      console.log('[AI] Response contains invalid content');
      return null;
    }

    console.log('[AI] Successfully generated script with:', parsed.historicalFigure);

    return {
      historicalNarrative: parsed.historicalNarrative,
      historicalFigure: parsed.historicalFigure,
      attraction: parsed.attraction || ''
    };

  } catch (error) {
    console.error('[AI] Error generating script:', error);
    return null;
  }
}

// Check if generated content contains invalid patterns
function containsInvalidContent(text: string): boolean {
  const invalidPatterns = [
    /詳しくはこちら/,
    /クリック/,
    /会社概要[｜|]/,
    /【[^】]{10,}】/,
    /https?:\/\//,
    /www\./,
  ];

  return invalidPatterns.some(pattern => pattern.test(text));
}
