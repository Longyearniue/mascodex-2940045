import { suggestHistoricalFigures, HistoricalFigure } from './salesLetter-historical-figures';

export function generateContextFromDeepAnalysis(analysis: any): any {
  const {
    businessType,
    location,
    foundedYear,
    keyFeatures,
    keywords,
    presidentMessage,
    philosophy,
    uniqueStrengths,
    specificInitiatives
  } = analysis;

  // 業種に応じた深い考察を生成（全データを渡してより独自性の高い文章を生成）
  const deepInsight = generateDeepInsight(
    businessType,
    location,
    keywords,
    philosophy,
    presidentMessage,
    uniqueStrengths,
    specificInitiatives,
    foundedYear
  );

  // Suggest historical figures
  const historicalFigures = suggestHistoricalFigures(
    businessType,
    philosophy,
    uniqueStrengths,
    location
  );

  return {
    attraction: deepInsight.attraction,
    uniqueApproach: deepInsight.uniqueApproach,
    businessType,
    historicalNarrative: deepInsight.historicalNarrative,
    historicalFigures
  };
}

// Generate deep insight for each business type with Murakami-style depth
function generateDeepInsight(
  businessType: string,
  location: string,
  keywords: string[],
  philosophy: string,
  presidentMessage: string,
  uniqueStrengths: string[],
  specificInitiatives: string[],
  foundedYear: string
): { attraction: string; uniqueApproach: string; historicalNarrative: string } {

  const locationStr = location || 'この地';

  // 企業の特徴を抽出
  const companyFeature = extractCompanyFeature(philosophy, presidentMessage, keywords);

  // 企業特徴から核となる概念を抽出（historicalNarrativeで使用）
  const coreConcept = extractCoreConcept(companyFeature);

  // ユニークな物語を生成（複数の要素を組み合わせて独自性を高める）
  const uniqueNarrative = generateUniqueNarrative(
    businessType,
    locationStr,
    foundedYear,
    coreConcept,
    philosophy,
    presidentMessage,
    uniqueStrengths,
    specificInitiatives,
    keywords
  );

  // すべての業種で共通のアプローチ: uniqueNarrativeを使用
  return {
    attraction: `${locationStr}で、${companyFeature ? companyFeature : getDefaultAttraction(businessType)}`,
    uniqueApproach: companyFeature || getDefaultApproach(businessType),
    historicalNarrative: uniqueNarrative
  };
}

// Get default attraction text for each business type
function getDefaultAttraction(businessType: string): string {
  const defaults: { [key: string]: string } = {
    'マッサージ・整体': 'お客様一人ひとりに合わせた丁寧な施術により、高い満足度とリピート率を実現しておられること',
    '美容業': 'お客様一人ひとりの個性を活かした施術により、高い満足度を実現しておられること',
    '飲食店': '地域に根ざした営業と、お客様との信頼関係を大切にした飲食店経営を続けておられること',
    '宿泊施設': 'お客様に満足いただけるおもてなしと、質の高いサービスを提供し続けておられること',
    '製造業': '品質へのこだわりと顧客満足を重視したものづくりを続けておられること',
    'IT企業': '顧客の課題解決を第一に考えたサービス提供を続けておられること',
    '医療機関': '患者一人ひとりに丁寧に向き合う医療を提供し続けておられること',
    '教育機関': '一人ひとりの生徒に向き合った教育を提供し続けておられること'
  };

  return defaults[businessType] || '地域社会との長期的な関係を大切にし、価値ある事業を続けておられること';
}

// Get default approach text for each business type
function getDefaultApproach(businessType: string): string {
  const defaults: { [key: string]: string } = {
    'マッサージ・整体': 'お客様との信頼関係を大切にし、きめ細かい対応を続けておられること',
    '美容業': 'お客様との信頼関係を重視し、きめ細かい対応を続けておられること',
    '飲食店': '一皿一皿の品質にこだわり、お客様に支持される店づくりを続けておられること',
    '宿泊施設': 'お客様一人ひとりに合わせたきめ細かい対応を大切にされていること',
    '製造業': '一つ一つの製品に真摯に向き合い、品質と信頼を大切にされていること',
    'IT企業': '技術力と顧客対応の両立により、信頼される企業として事業を展開されていること',
    '医療機関': '患者との信頼関係を大切にし、心身両面からのケアを重視されていること',
    '教育機関': '生徒の個性を大切にし、それぞれの可能性を引き出す教育を続けておられること'
  };

  return defaults[businessType] || '顧客満足と地域貢献を重視し、持続可能な事業展開を続けておられること';
}

// Generate natural description based on company data
function extractCompanyFeature(philosophy: string, presidentMessage: string, keywords: string[]): string {
  // Try philosophy first - if it's clean and natural, use it
  if (philosophy && philosophy.length > 30 && philosophy.length < 150) {
    const cleaned = philosophy
      .replace(/^[・\s]+/, '')
      .replace(/[。．]$/, '')
      .trim();

    const isNatural =
      cleaned.length > 20 &&
      cleaned.length < 100 &&
      !cleaned.match(/(キャンペーン|お知らせ|News|CP|予約|円|font-family|color:|margin:|olapa|piko|マシン|アンダーヘア|ツルツル|スベスベ|｢|｣)/) &&
      !cleaned.includes('。') &&
      (cleaned.match(/[、,]/g) || []).length <= 2;

    if (isNatural) {
      return cleaned + 'を大切にし、お客様から高い評価を得ておられること';
    }
  }

  // Try president message
  if (presidentMessage && presidentMessage.length > 30 && presidentMessage.length < 150) {
    const cleaned = presidentMessage
      .replace(/^[・\s]+/, '')
      .replace(/[。．]$/, '')
      .trim();

    const isNatural =
      cleaned.length > 20 &&
      cleaned.length < 100 &&
      !cleaned.match(/(キャンペーン|お知らせ|News|CP|予約|円|font-family|color:|margin:|olapa|piko|マシン|アンダーヘア|ツルツル|スベスベ|｢|｣)/) &&
      !cleaned.includes('。') &&
      (cleaned.match(/[、,]/g) || []).length <= 2;

    if (isNatural) {
      return cleaned + 'という姿勢で事業を展開しておられること';
    }
  }

  // Generate description from keywords if available
  if (keywords && keywords.length > 0) {
    const relevantKeywords = keywords
      .filter(kw =>
        kw.length > 2 &&
        kw.length < 20 &&
        !kw.match(/(News|CP|円|font-family|color|margin|キャンペーン|予約|お知らせ)/)
      )
      .slice(0, 3);

    if (relevantKeywords.length >= 2) {
      // Combine keywords into natural description
      const kw1 = relevantKeywords[0];
      const kw2 = relevantKeywords[1];

      // Check if keywords are service-related or value-related
      if (kw1.match(/(丁寧|親切|誠実|高品質|信頼|安心|満足)/)) {
        return `${kw1}な対応と${kw2}を重視し、お客様との長期的な信頼関係を築いておられること`;
      } else if (kw1.match(/(技術|品質|サービス|施術|料理|製品)/)) {
        return `${kw1}の高さと${kw2}により、お客様から高い評価を得ておられること`;
      } else {
        return `${kw1}と${kw2}を両立させながら、お客様満足を追求しておられること`;
      }
    } else if (relevantKeywords.length === 1) {
      const kw = relevantKeywords[0];
      return `${kw}を重視した事業展開により、お客様との信頼関係を大切にしておられること`;
    }
  }

  // Return empty to use business type specific template
  return '';
}

// Extract core concept from company feature for use in historical narrative
function extractCoreConcept(feature: string): string {
  if (!feature) return '';

  // Remove common suffixes to extract just the core concept
  return feature
    .replace(/を大切にし、お客様から高い評価を得ておられること$/, '')
    .replace(/という姿勢で事業を展開しておられること$/, '')
    .replace(/を重視し.*?信頼関係を築いておられること$/, '')
    .replace(/により、お客様から高い評価を得ておられること$/, '')
    .replace(/な対応と.*?信頼関係を築いておられること$/, '')
    .replace(/の高さと.*?高い評価を得ておられること$/, '')
    .replace(/と.*?を両立させながら.*?追求しておられること$/, '')
    .replace(/を重視した事業展開により.*?信頼関係を大切にしておられること$/, '')
    .trim();
}

// Generate truly unique narrative by combining multiple company aspects
// 企業の複数の特徴を組み合わせて、本当にユニークな物語を生成
function generateUniqueNarrative(
  businessType: string,
  location: string,
  foundedYear: string,
  coreConcept: string,
  philosophy: string,
  presidentMessage: string,
  uniqueStrengths: string[],
  specificInitiatives: string[],
  keywords: string[]
): string {
  // 企業の独自性を示す要素を抽出
  const uniqueElements: string[] = [];

  // 1. 創業年・歴史的背景
  if (foundedYear && foundedYear.match(/[0-9]{4}/)) {
    const year = foundedYear.match(/([0-9]{4})/);
    if (year) {
      const yearNum = parseInt(year[1]);
      if (yearNum < 1950) {
        uniqueElements.push(`${foundedYear}から続く伝統と技術`);
      } else if (yearNum < 1990) {
        uniqueElements.push(`${foundedYear}以来培われた経験と信頼`);
      } else {
        uniqueElements.push(`${foundedYear}創業の情熱と挑戦の精神`);
      }
    }
  }

  // 2. 具体的な取り組み・強み（最も重要な独自性）
  if (specificInitiatives.length > 0) {
    for (const initiative of specificInitiatives.slice(0, 2)) {
      if (initiative.length > 15 && initiative.length < 80) {
        const cleaned = initiative
          .replace(/^[・●◆]+/, '')
          .replace(/です$/, '')
          .replace(/ます$/, '')
          .trim();
        if (cleaned.length > 10) {
          uniqueElements.push(cleaned);
        }
      }
    }
  }

  // 3. 独自の強み
  if (uniqueStrengths.length > 0) {
    for (const strength of uniqueStrengths.slice(0, 2)) {
      if (strength.length > 15 && strength.length < 80) {
        const cleaned = strength
          .replace(/^[・●◆]+/, '')
          .replace(/です$/, '')
          .replace(/ます$/, '')
          .trim();
        if (cleaned.length > 10 && !uniqueElements.includes(cleaned)) {
          uniqueElements.push(cleaned);
        }
      }
    }
  }

  // 4. 理念・哲学から独自性を抽出
  if (philosophy) {
    const sentences = philosophy.split(/[。．]/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 70) {
        if (trimmed.match(/(こだわり|追求|目指|実現|大切|重視|提供|貢献)/)) {
          uniqueElements.push(trimmed);
          break;
        }
      }
    }
  }

  // 5. 社長メッセージから独自性を抽出
  if (uniqueElements.length < 2 && presidentMessage) {
    const sentences = presidentMessage.split(/[。．]/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 70) {
        if (trimmed.match(/(こだわり|追求|目指|実現|大切|重視|提供|貢献)/)) {
          uniqueElements.push(trimmed);
          break;
        }
      }
    }
  }

  // 6. キーワードから特徴的なものを抽出
  if (uniqueElements.length < 2 && keywords.length > 0) {
    const meaningfulKeywords = keywords.filter(kw =>
      kw.length > 2 &&
      kw.length < 15 &&
      !kw.match(/(ニュース|お知らせ|キャンペーン|円|NEWS|CP)/)
    );
    if (meaningfulKeywords.length > 0) {
      uniqueElements.push(meaningfulKeywords.slice(0, 2).join('と'));
    }
  }

  // 企業固有の内容から哲学的な表現を生成（テンプレート一切なし）
  const philosophicalStatement = generatePhilosophicalStatement(
    philosophy,
    presidentMessage,
    uniqueElements,
    coreConcept,
    businessType
  );

  // 複数の要素を組み合わせて、企業固有の深い物語を構築
  if (uniqueElements.length >= 2) {
    const elem1 = uniqueElements[0];
    const elem2 = uniqueElements[1];

    // 哲学的表現がある場合は使用、ない場合は要素のみで構成
    if (philosophicalStatement) {
      if (location && foundedYear) {
        return `「${philosophicalStatement}${elem1}。そして${elem2}。${location}という土地で、その想いを形にし続けてきた。それこそが、この事業の本質である」`;
      } else if (location) {
        return `「${philosophicalStatement}${elem1}。${elem2}。${location}という場所で、これらを大切にしながら、一歩一歩進んでいる。それが、ここで選ばれ続ける理由なのだ」`;
      } else if (foundedYear) {
        return `「${philosophicalStatement}${elem1}。そして${elem2}。創業以来変わらぬこの姿勢が、人々の信頼を得てきた。これからも、この道を歩み続ける」`;
      } else {
        return `「${philosophicalStatement}${elem1}。そして${elem2}。その想いを日々の営みの中で体現し続けている」`;
      }
    } else {
      // 哲学的表現がない場合: 要素だけで構成
      if (location && foundedYear) {
        return `「${elem1}。そして${elem2}。${location}という土地で、${foundedYear}からこれらを大切にし続けてきた」`;
      } else if (location) {
        return `「${elem1}。${elem2}。${location}という場所で、これらを実践し続けている」`;
      } else {
        return `「${elem1}。そして${elem2}。これらを日々の営みで体現し続けている」`;
      }
    }
  } else if (uniqueElements.length === 1) {
    const elem = uniqueElements[0];

    if (philosophicalStatement) {
      if (coreConcept) {
        return `「${philosophicalStatement}${coreConcept}。そして${elem}。この一貫した想いが、お客様との深い信頼関係を生み出している」`;
      } else {
        return `「${philosophicalStatement}${elem}。その想いを、一つ一つの行動で示し続けている」`;
      }
    } else {
      // 哲学的表現がない場合
      if (location) {
        return `「${elem}。それを${location}という土地で、日々実践し続けている」`;
      } else {
        return `「${elem}。それを、一つ一つの仕事で体現し続けている」`;
      }
    }
  } else {
    // 要素がない場合: コアコンセプトと哲学的表現のみ
    if (philosophicalStatement && coreConcept) {
      if (location) {
        return `「${philosophicalStatement}${coreConcept}。それを${location}という土地で、日々実践し続けている」`;
      } else {
        return `「${philosophicalStatement}${coreConcept}。それを貫き、お客様一人ひとりに真摯に向き合い続けている」`;
      }
    } else if (philosophicalStatement) {
      // 哲学的表現のみ
      if (location) {
        return `「${philosophicalStatement}それを${location}という土地で、実践し続けている」`;
      } else {
        return `「${philosophicalStatement}それを日々の営みで体現し続けている」`;
      }
    } else {
      // データが何もない場合のみ、最小限のフォールバック
      return generateMinimalUniqueNarrative(businessType, location);
    }
  }
}

// Generate unique philosophical statement from company's actual content
// 企業の実際の内容から、完全にユニークな哲学的表現を生成（テンプレート一切なし）
function generatePhilosophicalStatement(
  philosophy: string,
  presidentMessage: string,
  uniqueElements: string[],
  coreConcept: string,
  businessType: string
): string {
  // Helper: Clean and validate extracted text
  const cleanAndValidate = (text: string): string | null => {
    if (!text) return null;

    // Remove quotes (「」『』"" etc.) to prevent double quoting
    let cleaned = text
      .replace(/^[「『"']+/, '')
      .replace(/[」』"']+$/, '')
      .trim();

    // Filter out news/announcements/events (not philosophical)
    if (cleaned.match(/(^\d{4}[\.\/年月日]|お知らせ|ニュース|キャンペーン|イベント|開催|予約|受付|開始|終了|実施中|募集|参加|申込|詳細|見学会|説明会|CP|News)/)) {
      return null;
    }

    // Filter out too short or too long
    if (cleaned.length < 10 || cleaned.length > 80) {
      return null;
    }

    // Must not be just a date or number
    if (cleaned.match(/^[\d\s\-\/年月日]+$/)) {
      return null;
    }

    return cleaned;
  };

  // 1. 理念から価値観を示す文を抽出
  if (philosophy) {
    const philosophySentences = philosophy.split(/[。．]/);
    for (const sentence of philosophySentences) {
      const cleaned = cleanAndValidate(sentence);
      if (cleaned) {
        // 価値観を示すキーワードを含む文を優先
        if (cleaned.match(/(大切|重視|目指|追求|実現|貢献|提供|想い|信念|価値|使命|理念|ビジョン)/)) {
          return `${cleaned}。`;
        }
      }
    }
    // キーワードなしでも最初の有効な文を使う
    for (const sentence of philosophySentences) {
      const cleaned = cleanAndValidate(sentence);
      if (cleaned) {
        return `${cleaned}。`;
      }
    }
  }

  // 2. 社長メッセージから核心部分を抽出
  if (presidentMessage) {
    const messageSentences = presidentMessage.split(/[。．]/);
    for (const sentence of messageSentences) {
      const cleaned = cleanAndValidate(sentence);
      if (cleaned) {
        // 価値観を示すキーワードを含む文を優先
        if (cleaned.match(/(大切|重視|目指|追求|実現|貢献|提供|想い|信念|価値|使命)/)) {
          return `${cleaned}。`;
        }
      }
    }
    // キーワードなしでも最初の有効な文を使う
    for (const sentence of messageSentences) {
      const cleaned = cleanAndValidate(sentence);
      if (cleaned) {
        return `${cleaned}。`;
      }
    }
  }

  // 3. コアコンセプトを使う（既にクリーン）
  if (coreConcept && coreConcept.length > 8 && coreConcept.length < 80) {
    const cleaned = coreConcept.replace(/^[「『"']+/, '').replace(/[」』"']+$/, '').trim();
    if (cleaned) {
      return `${cleaned}。`;
    }
  }

  // 4. 独自要素を組み合わせる
  if (uniqueElements.length >= 2) {
    const elem1 = uniqueElements[0].replace(/^[「『"']+/, '').replace(/[」』"']+$/, '').trim();
    const elem2 = uniqueElements[1].replace(/^[「『"']+/, '').replace(/[」』"']+$/, '').trim();
    if (elem1 && elem2) {
      return `${elem1}と${elem2}。`;
    }
  } else if (uniqueElements.length === 1) {
    const elem = uniqueElements[0].replace(/^[「『"']+/, '').replace(/[」』"']+$/, '').trim();
    if (elem) {
      return `${elem}。`;
    }
  }

  // 5. データがない場合: 空文字列を返す
  return '';
}

// Minimal unique narrative as fallback (commercial-style with depth)
function generateMinimalUniqueNarrative(businessType: string, location: string): string {
  const locationStr = location || 'この地';

  const narratives: { [key: string]: string } = {
    'マッサージ・整体': `「癒やしとは、ただ痛みを取り除くことではない。一人ひとりの体に真摯に向き合い、その人本来の健やかさを取り戻す。心と体、その両方に寄り添いながら、${locationStr}で丁寧な施術を続けてきた。それこそが、真の癒やしなのだ」`,
    '美容業': `「美しさとは、表面を整えることだけではない。お客様一人ひとりの個性と魅力を引き出し、内側から輝く笑顔を実現する。その人らしさを大切にしながら、心からの美しさを追求し続ける。それこそが、真の美容である」`,
    '飲食店': `「食とは、ただ空腹を満たすものではない。食材一つ一つと真摯に向き合い、お客様と心を通わせ、温かな空間を創り続ける。${locationStr}の食文化を守りながら、人と人とのつながりを大切にする。それこそが、真の『食』の役割なのだ」`,
    '宿泊施設': `「宿とは、ただ休息を提供する場ではない。${locationStr}の風土と文化を伝え、訪れる方々に特別な時間と新たな気づきをもたらす。一期一会の心を大切にしながら、真のおもてなしを実践し続ける。それこそが、宿の本質である」`,
    '製造業': `「ものづくりとは、単に製品を生み出すことではない。職人の技と心を一つ一つの製品に込め、品質へのこだわりを次世代へと受け継いでいく。${locationStr}で培われた技術を大切にしながら、社会に価値を届け続ける。それこそが、真のものづくりである」`,
    'IT企業': `「技術とは、それ自体が目的ではない。技術革新と人の心をつなぎ、社会の課題を一つずつ解決していく。デジタルの力で人々の暮らしを豊かにし、新しい価値を創造し続ける。それこそが、技術の本質なのだ」`,
    '医療機関': `「医療とは、ただ病を治すことではない。患者一人ひとりの声に真摯に耳を傾け、心と体の両面から丁寧にケアを提供する。${locationStr}で地域医療を支えながら、信頼される存在であり続ける。それこそが、真の医療である」`,
    '教育機関': `「教育とは、知識を授けるだけではない。生徒一人ひとりの個性を大切にし、それぞれの可能性を信じて伸ばしていく。自ら考え、学び、成長する力を育みながら、未来を担う人材を育てる。それこそが、真の教育なのだ」`,
    '小売業': `「商いとは、品物を売ることだけではない。お客様一人ひとりと真摯に向き合い、人と人とのつながりを大切にする。${locationStr}で地域に根ざしながら、信頼関係を築き続ける。それこそが、真の商いの姿である」`,
  };

  return narratives[businessType] || `「事業とは、利益を追求するだけではない。お客様と真摯に向き合い、一つ一つの仕事に心を込めて価値を提供し続ける。${locationStr}という土地で、人々の暮らしに寄り添いながら、信頼される存在であり続ける。それこそが、真の事業の在り方なのだ」`;
}
