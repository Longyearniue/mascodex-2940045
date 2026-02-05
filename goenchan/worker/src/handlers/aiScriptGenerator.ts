// AI-powered creative script generator for sales letters using OpenAI API

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
  "historicalFigure": "歴史上の人物名（例：織田信長、坂本龍馬、福沢諭吉など）",
  "historicalNarrative": "その人物が語るセリフ（「」で囲んだ形式、100文字程度）",
  "attraction": "会社の魅力を一文で表現（50文字以内）"
}

重要なルール：
- 歴史上の人物のキャラクターと口調を活かした独特の語り口にする
- 会社の具体的な特徴や強みを必ず織り込む
- 面白くてインパクトがあり、記憶に残るセリフにする
- 広告っぽくならない自然で温かみのある表現にする
- その人物が本当にその会社を訪問して感動したかのように語る
- JSONのみを出力し、他の説明は一切不要`;

export async function generateCreativeScript(
  env: any,
  context: CompanyContext
): Promise<GeneratedScript | null> {
  // Check if OpenAI API key is available
  if (!env?.OPENAI_API_KEY) {
    console.log('[OpenAI] No API key available, skipping AI generation');
    return null;
  }

  try {
    const companyInfo = `
会社名: ${context.companyName}
業種: ${context.businessType}
所在地: ${context.location || '日本'}
理念・哲学: ${context.philosophy || '顧客満足を第一に'}
強み・特徴: ${context.uniqueStrengths?.filter(s => s && s.length > 5).slice(0, 3).join('、') || '地域密着のサービス'}
キーワード: ${context.keywords?.filter(k => k && k.length > 2).slice(0, 5).join('、') || '信頼、品質'}
`;

    console.log('[OpenAI] Generating creative script for:', context.companyName);
    console.log('[OpenAI] Company info:', companyInfo);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: CM_DIRECTOR_PROMPT
          },
          {
            role: 'user',
            content: `【会社情報】\n${companyInfo}\n\n上記の会社について、歴史上の人物が語るユニークで面白いセリフをJSON形式で生成してください。`
          }
        ],
        max_tokens: 500,
        temperature: 0.9, // Higher temperature for creativity
      })
    });

    if (!response.ok) {
      console.error('[OpenAI] API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json() as any;

    if (!data.choices || !data.choices[0]?.message?.content) {
      console.log('[OpenAI] No response content');
      return null;
    }

    const responseText = data.choices[0].message.content;
    console.log('[OpenAI] Raw response:', responseText);

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[OpenAI] Could not extract JSON from response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate the response
    if (!parsed.historicalNarrative || !parsed.historicalFigure) {
      console.log('[OpenAI] Invalid response structure');
      return null;
    }

    // Validate that the response doesn't contain junk
    if (containsInvalidContent(parsed.historicalNarrative)) {
      console.log('[OpenAI] Response contains invalid content');
      return null;
    }

    console.log('[OpenAI] Successfully generated script with:', parsed.historicalFigure);

    return {
      historicalNarrative: parsed.historicalNarrative,
      historicalFigure: parsed.historicalFigure,
      attraction: parsed.attraction || ''
    };

  } catch (error) {
    console.error('[OpenAI] Error generating script:', error);
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
    /Policy/i,
    /企業理念\s*経営理念/,
  ];

  return invalidPatterns.some(pattern => pattern.test(text));
}
