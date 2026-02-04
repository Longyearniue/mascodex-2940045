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

  // 業種に応じた深い考察を生成
  const deepInsight = generateDeepInsight(businessType, location, keywords, philosophy, presidentMessage);

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
  presidentMessage: string
): { attraction: string; uniqueApproach: string; historicalNarrative: string } {

  const locationStr = location || 'この地';

  // 企業の特徴を抽出
  const companyFeature = extractCompanyFeature(philosophy, presidentMessage, keywords);

  // 企業特徴から核となる概念を抽出（historicalNarrativeで使用）
  const coreConcept = extractCoreConcept(companyFeature);

  // マッサージ・整体
  if (businessType === 'マッサージ・整体') {
    return {
      attraction: `${locationStr}で、${companyFeature ? companyFeature : 'お客様一人ひとりに合わせた丁寧な施術により、高い満足度とリピート率を実現しておられること'}`,
      uniqueApproach: companyFeature || 'お客様との信頼関係を大切にし、きめ細かい対応を続けておられること',
      historicalNarrative: coreConcept
        ? `${coreConcept}が、長く支持される事業の基盤となる`
        : '施術の質と、お客様への誠実な対応が、長く支持される事業の基盤となる'
    };
  }

  // 美容業
  if (businessType === '美容業') {
    return {
      attraction: `${locationStr}で、${companyFeature ? companyFeature : 'お客様一人ひとりの個性を活かした施術により、高い満足度を実現しておられること'}`,
      uniqueApproach: companyFeature || 'お客様との信頼関係を重視し、きめ細かい対応を続けておられること',
      historicalNarrative: coreConcept
        ? `${coreConcept}が、長く支持される事業の基盤となる`
        : '美容サービスの質と、お客様への誠実な対応が、長く支持される事業の基盤となる'
    };
  }

  // 飲食店
  if (businessType === '飲食店') {
    return {
      attraction: `${locationStr}で、${companyFeature ? companyFeature : '地域に根ざした営業と、お客様との信頼関係を大切にした飲食店経営を続けておられること'}`,
      uniqueApproach: companyFeature || '一皿一皿の品質にこだわり、お客様に支持される店づくりを続けておられること',
      historicalNarrative: coreConcept
        ? `${coreConcept}が、お客様との長い信頼関係を築く。それが${locationStr}で支持される店の基盤となる`
        : `料理の質と接客の心が、お客様との長い信頼関係を築く。それが${locationStr}で支持される店の基盤となる`
    };
  }

  // 宿泊施設
  if (businessType === '宿泊施設') {
    return {
      attraction: `${locationStr}で、${companyFeature ? companyFeature : 'お客様に満足いただけるおもてなしと、質の高いサービスを提供し続けておられること'}`,
      uniqueApproach: companyFeature || 'お客様一人ひとりに合わせたきめ細かい対応を大切にされていること',
      historicalNarrative: coreConcept
        ? `${coreConcept}と、${locationStr}ならではの魅力が、お客様に選ばれる宿の基盤となる`
        : `サービスの質と、${locationStr}ならではの魅力が、お客様に選ばれる宿の基盤となる`
    };
  }

  // 製造業
  if (businessType === '製造業') {
    return {
      attraction: `${locationStr}で、${companyFeature ? companyFeature : '品質へのこだわりと顧客満足を重視したものづくりを続けておられること'}`,
      uniqueApproach: companyFeature || '一つ一つの製品に真摯に向き合い、品質と信頼を大切にされていること',
      historicalNarrative: coreConcept
        ? `${coreConcept}が、${locationStr}で信頼される企業の基盤となる`
        : `製品の質と顧客への誠実さが、${locationStr}で信頼される企業の基盤となる`
    };
  }

  // IT企業
  if (businessType === 'IT企業') {
    return {
      attraction: `${locationStr}で、${companyFeature ? companyFeature : '顧客の課題解決を第一に考えたサービス提供を続けておられること'}`,
      uniqueApproach: companyFeature || '技術力と顧客対応の両立により、信頼される企業として事業を展開されていること',
      historicalNarrative: coreConcept
        ? `${coreConcept}が、長く支持される企業の基盤となる`
        : '技術力と顧客満足の両立が、長く支持される企業の基盤となる'
    };
  }

  // 医療機関
  if (businessType === '医療機関') {
    return {
      attraction: `${locationStr}で、${companyFeature ? companyFeature : '患者一人ひとりに丁寧に向き合う医療を提供し続けておられること'}`,
      uniqueApproach: companyFeature || '患者との信頼関係を大切にし、心身両面からのケアを重視されていること',
      historicalNarrative: coreConcept
        ? `${coreConcept}が、地域に信頼される医療機関の基盤となる`
        : '医療の質と患者への誠実さが、地域に信頼される医療機関の基盤となる'
    };
  }

  // 教育機関
  if (businessType === '教育機関') {
    return {
      attraction: `${locationStr}で、${companyFeature ? companyFeature : '一人ひとりの生徒に向き合った教育を提供し続けておられること'}`,
      uniqueApproach: companyFeature || '生徒の個性を大切にし、それぞれの可能性を引き出す教育を続けておられること',
      historicalNarrative: coreConcept
        ? `${coreConcept}が、支持される教育機関の基盤となる`
        : '教育の質と生徒への真摯な姿勢が、支持される教育機関の基盤となる'
    };
  }

  // デフォルト（一般企業）
  return {
    attraction: `${locationStr}で、${companyFeature ? companyFeature : '地域社会との長期的な関係を大切にし、価値ある事業を続けておられること'}`,
    uniqueApproach: companyFeature || '顧客満足と地域貢献を重視し、持続可能な事業展開を続けておられること',
    historicalNarrative: coreConcept
      ? `${coreConcept}が、${locationStr}で信頼される企業の基盤となる`
      : `事業の質と地域への貢献が、${locationStr}で信頼される企業の基盤となる`
  };
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
