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

  // 1つの魅力ポイント（統合版）
  const attraction = deepInsight.attraction;

  // 御社独自の考え方 - より具体的に
  let uniqueApproach = '';
  if (philosophy) {
    const sentences = philosophy.split(/[。．]/);
    if (sentences.length > 1 && sentences[1].trim().length > 15) {
      uniqueApproach = sentences[1].trim();
    } else if (sentences[0].trim().length > 15) {
      uniqueApproach = sentences[0].trim() + 'という考え方';
    }
  } else if (presidentMessage) {
    const sentences = presidentMessage.split(/[。．]/);
    if (sentences.length > 1 && sentences[1].trim().length > 15) {
      uniqueApproach = sentences[1].trim() + 'という姿勢';
    }
  }

  if (!uniqueApproach) {
    if (uniqueStrengths.length >= 2) {
      uniqueApproach = `${uniqueStrengths[0].replace(/[。．]$/, '')}と${uniqueStrengths[1].replace(/[。．]$/, '')}を両立されている`;
    } else if (keyFeatures.length >= 2) {
      uniqueApproach = `${keyFeatures[0]}と${keyFeatures[1]}を両立させながら、${businessType}の新しい可能性を切り拓いておられる`;
    } else {
      uniqueApproach = `${businessType}としての本質を大切にしながら、独自の道を歩んでおられる`;
    }
  }

  // 歴史上の人物の視点からの試作文 - より深い内容に
  let historicalNarrative = '';

  // 企業理念や社長メッセージから本質を抽出
  const coreValue = extractCoreValue(philosophy, presidentMessage, uniqueStrengths);

  if (businessType === 'マッサージ・整体') {
    historicalNarrative = `「癒やしとは、ただ痛みを取り除くことではない。${coreValue ? coreValue : '心と体の両方に働きかけ、その人本来の健やかさを取り戻すこと'}。一人ひとりの体に向き合い、丁寧に施術を行う。それこそが真の癒やしなのだ」`;
  } else if (businessType === '美容業') {
    historicalNarrative = `「美しさとは、ただ外見を整えることではない。${coreValue ? coreValue : 'その人本来の魅力を引き出し、心と体が調和したとき'}、真の美しさが生まれる。一人ひとりに寄り添い、その人らしさを大切にする。それが真の美容である」`;
  } else if (businessType === '飲食店') {
    historicalNarrative = `「食とは、ただ空腹を満たすものではない。${coreValue ? coreValue : `${location ? `${location}の風土` : 'その土地の文化'}と作り手の心が一つになったとき`}、初めて人の心を動かす。人と人が集い、語らい、つながりを深める。それこそが真の「食」の役割なのだ」`;
  } else if (businessType === '製造業') {
    historicalNarrative = `「ものづくりとは、単に製品を生み出すことではない。${coreValue ? coreValue : `${location ? `${location}で培われた` : '先人から受け継いだ'}技術と、作り手の誇り`}を形にし、次の世代へと受け継ぐこと。それが真のものづくりである」`;
  } else if (businessType === '宿泊施設') {
    historicalNarrative = `「宿とは、ただ休息を提供する場ではない。${coreValue ? coreValue : `${location ? `${location}の歴史と文化` : 'その土地の物語'}を伝え、訪れる人々に新たな気づきをもたらす`}。真の「おもてなし」とは、心と心を通わせることなのだ」`;
  } else if (businessType === 'IT企業') {
    historicalNarrative = `「技術とは、それ自体が目的ではない。${coreValue ? coreValue : '人々の暮らしを豊かにし、社会の課題を解決するための手段'}である。技術と人の心が重なったとき、初めて本当の価値が生まれる」`;
  } else {
    historicalNarrative = `「事業とは、単に利益を追求するものではない。${coreValue ? coreValue : `${location ? `${location}という土地` : 'この地'}で、人々の暮らしに寄り添い、社会に価値を提供し続けること`}。それこそが真の事業の在り方である」`;
  }

  // Suggest historical figures
  const historicalFigures = suggestHistoricalFigures(
    businessType,
    philosophy,
    uniqueStrengths,
    location
  );

  return {
    attraction,
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

// Extract core value from philosophy/message
function extractCoreValue(philosophy: string, presidentMessage: string, uniqueStrengths: string[]): string {
  // Try philosophy first
  if (philosophy && philosophy.length > 20) {
    const sentences = philosophy.split(/[。．]/);
    for (const sentence of sentences) {
      if (sentence.length > 15 && sentence.length < 120) {
        // Look for sentences with core value keywords
        if (sentence.match(/(大切|重視|目指|実現|提供|貢献|追求)/)) {
          return sentence.trim();
        }
      }
    }
  }

  // Try president message
  if (presidentMessage && presidentMessage.length > 20) {
    const sentences = presidentMessage.split(/[。．]/);
    for (const sentence of sentences) {
      if (sentence.length > 15 && sentence.length < 120) {
        if (sentence.match(/(大切|重視|目指|実現|提供|貢献|追求)/)) {
          return sentence.trim();
        }
      }
    }
  }

  // Try unique strengths
  if (uniqueStrengths.length > 0) {
    const strength = uniqueStrengths[0].replace(/[。．]$/, '');
    if (strength.length > 15 && strength.length < 120) {
      return strength;
    }
  }

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

  // 複数の要素を組み合わせてユニークな物語を構築
  if (uniqueElements.length >= 2) {
    // パターン1: 要素A、要素B、そしてC
    const elem1 = uniqueElements[0];
    const elem2 = uniqueElements[1];

    if (location && foundedYear) {
      return `${elem1}。${elem2}。それこそが${location}の${businessType}として歩み続ける道である`;
    } else if (location) {
      return `${elem1}。そして${elem2}。これらが${location}で選ばれる理由となっている`;
    } else if (foundedYear) {
      return `${elem1}。${elem2}。これが創業以来変わらぬ姿勢である`;
    } else {
      return `${elem1}。${elem2}。それが真の${businessType}の在り方なのだ`;
    }
  } else if (uniqueElements.length === 1) {
    // パターン2: 単一要素をより深く
    const elem = uniqueElements[0];

    if (coreConcept) {
      return `${coreConcept}。${elem}。この一貫した姿勢こそが、顧客から信頼される所以である`;
    } else {
      return `${elem}。それを体現し続けることで、真の価値を生み出している`;
    }
  } else {
    // パターン3: コアコンセプトをベースに
    if (coreConcept) {
      if (location) {
        return `${coreConcept}という信念。それを${location}という土地で実践し続けることで、地域に根ざした存在となっている`;
      } else {
        return `${coreConcept}という信念を貫き、お客様一人ひとりに向き合い続けることで、揺るぎない信頼を築いている`;
      }
    } else {
      // フォールバック: 業種に応じた最低限のユニークな表現
      return generateMinimalUniqueNarrative(businessType, location);
    }
  }
}

// Minimal unique narrative as fallback
function generateMinimalUniqueNarrative(businessType: string, location: string): string {
  const locationStr = location || 'この地';

  const narratives: { [key: string]: string } = {
    'マッサージ・整体': `一人ひとりの体に真摯に向き合い、その人本来の健やかさを取り戻す。それが${locationStr}で続けてきた施術の道である`,
    '美容業': `お客様の個性と魅力を引き出し、心からの笑顔を実現する。それこそが美容の本質である`,
    '飲食店': `食材と向き合い、お客様と語らい、心通う空間を創り続ける。それが${locationStr}の食文化を支える`,
    '宿泊施設': `${locationStr}の風土と文化を伝え、訪れる方々に特別な時間を提供し続けることで、真のおもてなしを実現している`,
    '製造業': `ものづくりへのこだわりと技術の継承。それを次世代へつなぎ、社会に価値を届け続けている`,
    'IT企業': `技術革新と人の心をつなぎ、社会課題の解決に取り組み続けることで、デジタル時代の価値を創造している`,
    '医療機関': `患者一人ひとりの声に耳を傾け、心と体の両面からケアを提供することで、地域医療を支え続けている`,
    '教育機関': `生徒の個性を大切にし、それぞれの可能性を信じて伸ばし続けることで、未来を担う人材を育んでいる`
  };

  return narratives[businessType] || `お客様と真摯に向き合い、価値を提供し続けることで、${locationStr}で信頼される存在となっている`;
}
