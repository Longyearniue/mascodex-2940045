import { parseDocument } from 'htmlparser2';
import { Element, isTag, isText } from 'domhandler';

export interface DeepAnalysisResult {
  summary: string;
  businessType: string;
  location: string;
  foundedYear: string;
  keyFeatures: string[];
  keywords: string[];
  presidentMessage: string;
  philosophy: string;
  uniqueStrengths: string[];
  specificInitiatives: string[];
}

// Extract text from specific sections
function extractSectionText(html: string, node: any, sectionKeywords: string[]): string[] {
  const results: string[] = [];

  function traverse(n: any, depth: number = 0) {
    if (depth > 10) return; // Prevent infinite recursion

    if (isTag(n)) {
      const element = n as Element;

      // Check if this element or its attributes match section keywords
      const elementText = getDirectText(element);
      const className = element.attribs?.class || '';
      const id = element.attribs?.id || '';
      const combined = (elementText + className + id).toLowerCase();

      const isRelevantSection = sectionKeywords.some(kw => combined.includes(kw.toLowerCase()));

      if (isRelevantSection) {
        // Extract all text from this section
        const sectionText = extractAllText(element);
        if (sectionText.length > 50) {
          results.push(sectionText);
        }
      }
    }

    if ('children' in n) {
      for (const child of n.children) {
        traverse(child, depth + 1);
      }
    }
  }

  const document = parseDocument(html);
  traverse(document);
  return results;
}

// Get direct text content (not from children)
function getDirectText(element: Element): string {
  const textParts: string[] = [];
  for (const child of element.children) {
    if (isText(child)) {
      textParts.push(child.data.trim());
    }
  }
  return textParts.join(' ');
}

// Extract all text content from element and children
function extractAllText(node: any): string {
  const textParts: string[] = [];

  function traverse(n: any) {
    // Skip script and style tags
    if (isTag(n)) {
      const element = n as Element;
      if (element.name === 'script' || element.name === 'style' || element.name === 'noscript') {
        return;
      }
    }

    if (isText(n)) {
      const text = n.data.trim();
      if (text.length > 0) {
        textParts.push(text);
      }
    }

    if ('children' in n) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return textParts.join(' ');
}

// Extract all text content from HTML
function extractTextFromHTML(html: string): string {
  const document = parseDocument(html);
  return extractAllText(document);
}

// Extract content from full text when section search fails
function extractFromFullText(text: string, keywords: string[]): string {
  const lowerText = text.toLowerCase();

  // Find paragraphs that contain keywords
  const paragraphs = text.split(/\n\n+/);
  const relevantParagraphs: string[] = [];

  for (const para of paragraphs) {
    const lowerPara = para.toLowerCase();
    if (keywords.some(kw => lowerPara.includes(kw.toLowerCase()))) {
      // Extract meaningful sentences from this paragraph
      const sentences = para.split(/[。．.!！?？]/);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length > 20 && trimmed.length < 300) {
          // Check if it contains Japanese and meaningful content
          if (trimmed.match(/[ぁ-んァ-ヶー一-龠]/) && !trimmed.match(/(function|var|const|let|return|article|labelTags)/)) {
            relevantParagraphs.push(trimmed);
            if (relevantParagraphs.length >= 3) break;
          }
        }
      }
      if (relevantParagraphs.length >= 3) break;
    }
  }

  return relevantParagraphs.join('。');
}

// Extract long meaningful sentences from text (when keyword search fails)
function extractLongMeaningfulSentences(text: string): string[] {
  const sentences = text.split(/[。．]/);
  const scored: Array<{sentence: string, score: number}> = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();

    // Skip short sentences, code, CSS, etc.
    if (trimmed.length < 30 || trimmed.length > 150) continue; // Stricter length for natural flow
    if (!trimmed.match(/[ぁ-んァ-ヶー一-龠]/)) continue; // Must contain Japanese
    if (trimmed.match(/(function|var|const|let|return|article|labelTags|font-family|color:|margin:|padding:|olapa|piko|マシン|ツルツル|スベスベ|｢|｣)/)) continue;
    if (trimmed.match(/^[0-9\s\-\/]+$/)) continue; // Skip dates/numbers only
    if (trimmed.split(' ').length < 3) continue; // Must have multiple words
    if (trimmed.includes('。')) continue; // Should be single sentence for natural flow
    if ((trimmed.match(/[、,]/g) || []).length > 2) continue; // Not too many clauses

    // Calculate score based on:
    // - Length (longer is better)
    // - Presence of meaningful keywords
    // - Sentence structure
    let score = trimmed.length;

    // Bonus for containing meaningful words
    if (trimmed.match(/(目指|大切|重視|こだわり|思い|想い|理念|ビジョン|提供|貢献|実現|取り組|サービス|お客様)/)) {
      score += 100;
    }

    // Bonus for complete sentences
    if (trimmed.match(/(です|ます|ません|いる|ある|おり)$/)) {
      score += 50;
    }

    // Penalty for menu/navigation items
    if (trimmed.match(/(メニュー|料金|アクセス|お問い合わせ|プライバシー|利用規約)/)) {
      score -= 100;
    }

    // Penalty for product names, brand names, overly specific content
    if (trimmed.match(/[A-Za-z]{5,}/)) { // Long English words (brand names)
      score -= 80;
    }

    // Penalty for promotional language
    if (trimmed.match(/(導入|キャンペーン|実施中|お得|円|割引|％OFF)/)) {
      score -= 100;
    }

    // Penalty for very specific descriptions
    if (trimmed.match(/(アンダーヘア|ツルツル|スベスベ|ムダ毛|脱毛マシン)/)) {
      score -= 150;
    }

    scored.push({ sentence: trimmed, score });
  }

  // Sort by score and return top sentences
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(s => s.sentence);
}

export function performDeepAnalysis(html: string, url: string): DeepAnalysisResult {
  const text = extractTextFromHTML(html);
  const lowerText = text.toLowerCase();
  const document = parseDocument(html);

  // 1. 社長メッセージ・代表挨拶の抽出（セクション検索 + 全文検索）
  const presidentKeywords = ['代表挨拶', '社長挨拶', '社長メッセージ', 'トップメッセージ', '代表メッセージ',
                             'ceoメッセージ', 'president', 'message', 'greeting', '代表より', '院長挨拶', '院長より', 'オーナーより'];
  const presidentSections = extractSectionText(html, document, presidentKeywords);
  let presidentMessage = extractMeaningfulContent(presidentSections.join(' '));

  // Fallback: Extract from full text if section search fails
  if (!presidentMessage || presidentMessage.length < 50) {
    presidentMessage = extractFromFullText(text, presidentKeywords);
  }

  // Fallback 2: Extract meaningful long sentences if still empty
  if (!presidentMessage || presidentMessage.length < 50) {
    const meaningfulSentences = extractLongMeaningfulSentences(text);
    if (meaningfulSentences.length > 0) {
      presidentMessage = meaningfulSentences.slice(0, 2).join('。');
    }
  }

  // 2. 企業理念・ビジョンの抽出（セクション検索 + 全文検索）
  const philosophyKeywords = ['企業理念', 'ビジョン', 'ミッション', '経営理念', '理念', 'vision', 'mission',
                              'philosophy', '私たちの想い', '私たちの思い', 'our vision', 'コンセプト', '想い', '思い', '目指'];
  const philosophySections = extractSectionText(html, document, philosophyKeywords);
  let philosophy = extractMeaningfulContent(philosophySections.join(' '));

  // Fallback: Extract from full text
  if (!philosophy || philosophy.length < 50) {
    philosophy = extractFromFullText(text, philosophyKeywords);
  }

  // Fallback 2: Extract meaningful long sentences
  if (!philosophy || philosophy.length < 50) {
    const meaningfulSentences = extractLongMeaningfulSentences(text);
    if (meaningfulSentences.length > 0) {
      philosophy = meaningfulSentences[0];
    }
  }

  // 3. 独自の強み・特徴の抽出（より広範囲に）
  const strengthKeywords = ['強み', '特徴', 'こだわり', '特長', '選ばれる理由', 'strength', 'feature',
                            '私たちの', '当社の', '弊社の', 'ポイント', 'メリット', '魅力'];
  const strengthSections = extractSectionText(html, document, strengthKeywords);
  let uniqueStrengths = extractKeyPoints(strengthSections.join(' '));

  // Fallback: Extract from full text
  if (uniqueStrengths.length === 0) {
    const fullTextStrengths = extractFromFullText(text, strengthKeywords);
    if (fullTextStrengths) {
      uniqueStrengths = extractKeyPoints(fullTextStrengths);
    }
  }

  // 4. 具体的な取り組みの抽出
  const initiativeKeywords = ['取り組み', '活動', '実績', '事例', 'initiative', '導入', '開発', '展開', 'サービス', 'メニュー'];
  const initiativeSections = extractSectionText(html, document, initiativeKeywords);
  let specificInitiatives = extractKeyPoints(initiativeSections.join(' '));

  // Fallback: Extract from full text
  if (specificInitiatives.length === 0) {
    const fullTextInitiatives = extractFromFullText(text, initiativeKeywords);
    if (fullTextInitiatives) {
      specificInitiatives = extractKeyPoints(fullTextInitiatives);
    }
  }

  // 5. 基本情報の抽出
  const businessType = detectBusinessType(text, lowerText);
  const location = extractLocation(text);
  const foundedYear = extractFoundedYear(text);

  // 6. 主要な特徴の抽出（深い分析結果を反映）
  const keyFeatures = extractDeepKeyFeatures(presidentMessage, philosophy, uniqueStrengths, specificInitiatives);

  // 7. キーワードの抽出
  const keywords = extractKeywords(text, lowerText);

  // 8. サマリーの生成
  const summary = generateDeepSummary(businessType, location, foundedYear, presidentMessage, philosophy, uniqueStrengths);

  return {
    summary,
    businessType,
    location,
    foundedYear,
    keyFeatures,
    keywords,
    presidentMessage,
    philosophy,
    uniqueStrengths,
    specificInitiatives
  };
}

// Extract meaningful content (filter out navigation, headers, etc.)
function extractMeaningfulContent(text: string): string {
  if (!text || text.length < 30) return '';

  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, ' ').trim();

  // Remove CSS patterns
  cleaned = cleaned.replace(/[\w-]+:\s*[^;]+;/g, ''); // CSS properties
  cleaned = cleaned.replace(/\{[^}]*:[^}]*\}/g, ''); // CSS blocks
  cleaned = cleaned.replace(/#[0-9a-fA-F]{3,6}/g, ''); // Color codes
  cleaned = cleaned.replace(/\d+(?:px|em|rem|%|vh|vw)/g, ''); // CSS units
  cleaned = cleaned.replace(/font-family:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/rgba?\([^)]+\)/g, '');

  // Remove JavaScript code patterns
  cleaned = cleaned.replace(/\b(function|var|const|let|return|if|else|for|while)\s*[\(\{]/g, '');
  cleaned = cleaned.replace(/article\(['"#][^)]+\)/g, '');

  // Remove overly promotional/sales content
  cleaned = cleaned.replace(/｢[^｣]*｣/g, ''); // Remove full-width quotes
  cleaned = cleaned.replace(/[「『][^」』]*[」』]/g, ''); // Remove quotes

  // Extract sentences that are meaningful (>20 chars, contain substance)
  const sentences = cleaned.split(/[。．.!！?？]/);
  const meaningful = sentences.filter(s => {
    s = s.trim();

    // Filter out navigation, code, and junk
    if (s.length < 20) return false;
    if (s.match(/^(ホーム|メニュー|お問い合わせ|会社概要|サイトマップ|ニュース一覧|詳しく|もっと|こちら)/)) return false;
    if (s.match(/(function|var|const|let|return|article|labelTags|size:|type\d)/)) return false;
    if (s.match(/^[a-zA-Z0-9_\-\s]+$/)) return false; // Only alphanumeric
    if (s.match(/^[\d\s\-\/]+$/)) return false; // Only numbers and symbols

    // Must contain Japanese characters
    if (!s.match(/[ぁ-んァ-ヶー一-龠]/)) return false;

    // Must have substance
    return s.match(/(です|ます|ある|いる|おり|られ|こと|もの|よう)/);
  });

  return meaningful.slice(0, 3).join('。') + (meaningful.length > 0 ? '。' : '');
}

// Extract key points from text
function extractKeyPoints(text: string): string[] {
  if (!text || text.length < 30) return [];

  const points: string[] = [];

  // Look for bullet points, numbered lists, or clear statements
  const lines = text.split(/[\n\r]+/);

  for (const line of lines) {
    const trimmed = line.trim();

    // Match bullet points or numbered items
    if (trimmed.match(/^[・●▪︎■□◆◇▶︎►①-⑩1-9０-９][）\)．.\s]/)) {
      const content = trimmed.replace(/^[・●▪︎■□◆◇▶︎►①-⑩1-9０-９][）\)．.\s]+/, '').trim();
      if (content.length > 10 && content.length < 200) {
        points.push(content);
      }
    }
    // Match sentences with strong keywords
    else if (trimmed.length > 20 && trimmed.length < 200) {
      if (trimmed.match(/(実現|提供|貢献|重視|大切|こだわり|追求|目指|取り組)/)) {
        points.push(trimmed);
      }
    }
  }

  return points.slice(0, 5);
}

// Extract deep key features from analyzed content
function extractDeepKeyFeatures(
  presidentMessage: string,
  philosophy: string,
  uniqueStrengths: string[],
  specificInitiatives: string[]
): string[] {
  const features: string[] = [];

  // From president message
  if (presidentMessage) {
    if (presidentMessage.match(/(地域|社会|コミュニティ|お客様|顧客)/)) {
      const match = presidentMessage.match(/([^。]+?(地域|社会|コミュニティ|お客様|顧客)[^。]{0,50})/);
      if (match) features.push(match[1].trim());
    }
  }

  // From philosophy
  if (philosophy) {
    const sentences = philosophy.split(/[。．]/);
    for (const sentence of sentences) {
      if (sentence.length > 15 && sentence.length < 100) {
        features.push(sentence.trim());
        if (features.length >= 4) break;
      }
    }
  }

  // From unique strengths
  features.push(...uniqueStrengths.slice(0, 3));

  // From specific initiatives
  if (specificInitiatives.length > 0 && features.length < 4) {
    features.push(...specificInitiatives.slice(0, 2));
  }

  return features.slice(0, 4);
}

// Generate deep summary
function generateDeepSummary(
  businessType: string,
  location: string,
  foundedYear: string,
  presidentMessage: string,
  philosophy: string,
  uniqueStrengths: string[]
): string {
  const parts: string[] = [];

  // Basic info
  if (location && foundedYear) {
    parts.push(`${location}で${foundedYear}に創業された${businessType}`);
  } else if (location) {
    parts.push(`${location}を拠点とする${businessType}`);
  } else {
    parts.push(businessType);
  }

  // Philosophy or president message highlight
  if (philosophy) {
    const firstSentence = philosophy.split(/[。．]/)[0];
    if (firstSentence && firstSentence.length > 10) {
      parts.push(`「${firstSentence}」という理念のもと事業を展開`);
    }
  } else if (presidentMessage) {
    const firstSentence = presidentMessage.split(/[。．]/)[0];
    if (firstSentence && firstSentence.length > 10) {
      parts.push(`代表は「${firstSentence}」と述べ`);
    }
  }

  // Unique strengths
  if (uniqueStrengths.length > 0) {
    parts.push(uniqueStrengths[0]);
  }

  return parts.join('。') + 'されている企業様';
}

function detectBusinessType(text: string, lowerText: string): string {
  const businessPatterns = [
    { keywords: ['飲食', 'レストラン', '食堂', 'カフェ', '居酒屋', '料理'], type: '飲食店' },
    { keywords: ['宿泊', '旅館', 'ホテル', '民宿', 'ゲストハウス'], type: '宿泊施設' },
    { keywords: ['マッサージ', 'もみほぐし', 'リンパケア', '整体', 'リラクゼーション', '指圧', 'ボディケア', 'あん摩'], type: 'マッサージ・整体' },
    { keywords: ['美容', 'エステ', '美容室', 'ヘアサロン', '理容', 'ネイル', 'まつげ', 'フェイシャル'], type: '美容業' },
    { keywords: ['製造', '工場', 'メーカー', '製作所', '工業'], type: '製造業' },
    { keywords: ['小売', '商店', '店舗', 'ショップ', '販売'], type: '小売業' },
    { keywords: ['建設', '建築', '工務店', 'リフォーム', '設計'], type: '建設業' },
    { keywords: ['医療', '病院', 'クリニック', '診療所', '薬局', '歯科'], type: '医療機関' },
    { keywords: ['教育', '学校', '塾', 'スクール', '教室'], type: '教育機関' },
    { keywords: ['システム開発', 'ソフトウェア開発', 'it企業', 'アプリ開発', 'web開発', 'エンジニア'], type: 'IT企業' },
    { keywords: ['農業', '農園', '農場', '栽培', '生産'], type: '農業' }
  ];

  for (const pattern of businessPatterns) {
    if (pattern.keywords.some(kw => lowerText.includes(kw))) {
      return pattern.type;
    }
  }

  return '企業';
}

function extractLocation(text: string): string {
  // 都道府県の抽出
  const prefectures = [
    '北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島',
    '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川',
    '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知',
    '三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山',
    '鳥取', '島根', '岡山', '広島', '山口',
    '徳島', '香川', '愛媛', '高知',
    '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'
  ];

  for (const pref of prefectures) {
    if (text.includes(pref)) {
      // 市区町村も抽出を試みる
      const cityMatch = text.match(new RegExp(`${pref}[都道府県]?([^\\s、。]{2,10}[市区町村])`));
      if (cityMatch) {
        return `${pref}${cityMatch[1]}`;
      }
      return pref;
    }
  }

  return '';
}

function extractFoundedYear(text: string): string {
  // 創業年のパターン：「創業1950年」「設立 昭和25年」など
  const patterns = [
    /創業[\s　]*([0-9]{4})年/,
    /設立[\s　]*([0-9]{4})年/,
    /([0-9]{4})年[\s　]*創業/,
    /([0-9]{4})年[\s　]*設立/,
    /昭和([0-9]{1,2})年[\s　]*創業/,
    /昭和([0-9]{1,2})年[\s　]*設立/,
    /平成([0-9]{1,2})年[\s　]*創業/,
    /平成([0-9]{1,2})年[\s　]*設立/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('昭和')) {
        const showaYear = parseInt(match[1]);
        const westernYear = 1925 + showaYear;
        return `昭和${showaYear}年（${westernYear}年）`;
      } else if (pattern.source.includes('平成')) {
        const heiseiYear = parseInt(match[1]);
        const westernYear = 1988 + heiseiYear;
        return `平成${heiseiYear}年（${westernYear}年）`;
      }
      return `${match[1]}年`;
    }
  }

  return '';
}

function extractKeyFeatures(text: string, lowerText: string, businessType: string): string[] {
  const features: string[] = [];

  // 特徴キーワード
  const featurePatterns = [
    { keywords: ['地域密着', '地元', 'コミュニティ'], feature: '地域に根ざした' },
    { keywords: ['伝統', '老舗', '歴史'], feature: '伝統を大切にしている' },
    { keywords: ['手作り', '手づくり', '職人', '技術'], feature: '職人技と手作りにこだわる' },
    { keywords: ['品質', 'こだわり', '厳選'], feature: '品質へのこだわり' },
    { keywords: ['環境', 'エコ', 'サステナブル', '持続可能'], feature: '環境への配慮' },
    { keywords: ['革新', '最新', '技術革新', 'イノベーション'], feature: '革新的な取り組み' },
    { keywords: ['顧客', 'お客様', '満足', 'サービス'], feature: '顧客第一の姿勢' },
    { keywords: ['安全', '安心', '信頼'], feature: '安全・安心への取り組み' },
    { keywords: ['オーダーメイド', 'カスタム', 'オリジナル'], feature: 'カスタマイズ対応' }
  ];

  for (const pattern of featurePatterns) {
    if (pattern.keywords.some(kw => lowerText.includes(kw))) {
      features.push(pattern.feature);
    }
  }

  // 代表メッセージの存在
  if (lowerText.includes('代表挨拶') || lowerText.includes('社長メッセージ') || lowerText.includes('代表者')) {
    features.push('経営者の想いを発信');
  }

  return features.slice(0, 4); // 最大4つまで
}

function extractKeywords(text: string, lowerText: string): string[] {
  const keywords: Set<string> = new Set();

  // 重要キーワードのパターン
  const keywordPatterns = [
    '地域貢献', '社会貢献', 'CSR',
    '伝統技術', '匠の技', '職人',
    'イノベーション', 'DX', 'デジタル化',
    'サステナビリティ', 'SDGs',
    'グローバル', '海外展開',
    '品質管理', 'ISO',
    '顧客満足', 'CS',
    '人材育成', '技術継承',
    'ワークライフバランス', '働き方改革'
  ];

  for (const keyword of keywordPatterns) {
    if (lowerText.includes(keyword.toLowerCase())) {
      keywords.add(keyword);
    }
  }

  return Array.from(keywords).slice(0, 5);
}

function generateSummary(
  businessType: string,
  location: string,
  foundedYear: string,
  keyFeatures: string[],
  keywords: string[]
): string {
  const parts: string[] = [];

  // 基本情報
  if (location && foundedYear) {
    parts.push(`${location}で${foundedYear}に創業された${businessType}`);
  } else if (location) {
    parts.push(`${location}を拠点とする${businessType}`);
  } else if (foundedYear) {
    parts.push(`${foundedYear}創業の${businessType}`);
  } else {
    parts.push(businessType);
  }

  // 特徴
  if (keyFeatures.length > 0) {
    parts.push(keyFeatures.join('、'));
  }

  // キーワード
  if (keywords.length > 0) {
    parts.push(`特に${keywords.slice(0, 2).join('や')}に注力`);
  }

  return parts.join('。') + 'されている企業様';
}
