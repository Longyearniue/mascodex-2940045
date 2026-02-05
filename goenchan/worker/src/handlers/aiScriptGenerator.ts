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

const CM_DIRECTOR_PROMPT = `あなたは2つの役割を担っています：

【役割1】営業担当者として、この会社に連絡する「理由」を考えてください。
以下の文章の[ここ]の部分を埋めてください：
「御社の公式サイトを拝見し、[ここ]という点に強く惹かれ、ご連絡いたしました。」

[ここ]に入る内容のルール：
- 会社の具体的な事業内容、独自の取り組み、こだわりを述べる
- 「地域密着」「信頼」「安心」「サービス」だけの抽象的表現は禁止
- その会社ならではの具体的な魅力を30〜80文字で表現
- 例：「創業50年の実績を活かし、オーナー様の資産価値を最大化する独自の管理手法を確立されている」
- 例：「北海道の厳しい気候に対応した断熱リフォームのノウハウを蓄積されている」

【役割2】CMディレクターとして、歴史上の人物が語るユニークなセリフを考えてください。
- この会社の特徴と顧客に一番アピールすべき部分を端的に表現
- 面白くてユニークな他社とは違うセリフを考えて考えて考え抜いて面白いセリフを作る
- 歴史上の人物のキャラクターと口調を活かした独特の語り口にする

以下の形式でJSON形式で回答してください：
{
  "historicalFigure": "歴史上の人物名（例：織田信長、坂本龍馬、福沢諭吉など）",
  "historicalNarrative": "その人物が語るセリフ（「」で囲んだ形式、80〜120文字）",
  "attraction": "[ここ]に入る具体的な内容（30〜80文字、前後の「御社の〜」「という点に〜」は含めない）"
}

重要：
- attractionには「御社の公式サイトを拝見し、」や「という点に強く惹かれ」を含めないでください
- attractionは具体的な内容のみ（例：「創業以来30年間、地元の方々との信頼関係を大切に、一棟一棟丁寧な管理を続けておられる」）
- historicalNarrativeは「」で囲んだセリフ形式
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
