import { fetchWithTimeout } from '../utils/fetcher';
import { calculateContentScore, extractContactPages, extractFaxNumbers } from '../utils/parser';
import { parseDocument } from 'htmlparser2';
import { Element, isTag, isText } from 'domhandler';
import { performDeepAnalysis } from './salesLetter-deep-analysis';
import { generateContextFromDeepAnalysis } from './salesLetter-context';
import { HistoricalFigure } from './salesLetter-historical-figures';

interface PageResult {
  url: string;
  html: string;
}

// Fetch multiple pages from the website for deeper analysis
async function fetchMultiplePages(baseUrl: string, maxPages: number = 10): Promise<PageResult[]> {
  const pages: PageResult[] = [];
  const visitedUrls = new Set<string>();

  // 1. Fetch the main page
  const mainPage = await fetchWithTimeout(baseUrl, 10000);
  if (!mainPage.success || !mainPage.html) {
    return pages;
  }

  pages.push({ url: baseUrl, html: mainPage.html });
  visitedUrls.add(baseUrl);

  // 2. Extract relevant links from main page
  const relevantLinks = extractRelevantLinks(mainPage.html, baseUrl);

  // 3. Fetch additional pages (up to maxPages total)
  for (const link of relevantLinks) {
    if (pages.length >= maxPages) break;
    if (visitedUrls.has(link)) continue;

    console.log('Fetching additional page:', link);
    const page = await fetchWithTimeout(link, 10000);

    if (page.success && page.html) {
      pages.push({ url: link, html: page.html });
      visitedUrls.add(link);
    }

    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Fetched ${pages.length} pages for analysis`);
  return pages;
}

// Extract links to pages likely to contain important company information
function extractRelevantLinks(html: string, baseUrl: string): string[] {
  const document = parseDocument(html);
  const links: string[] = [];

  // Keywords for relevant pages (in Japanese and English)
  const relevantKeywords = [
    // 会社情報
    '会社概要', 'about', 'company', '企業情報', '概要', '会社案内',
    // 代表メッセージ
    '代表挨拶', '社長挨拶', '代表メッセージ', 'message', 'greeting', 'ceo', 'トップメッセージ',
    '社長メッセージ', '院長挨拶', '代表より', 'オーナーより',
    // 理念・ビジョン
    '理念', 'ビジョン', 'ミッション', 'vision', 'mission', 'philosophy', '経営理念',
    '私たちの想い', '私たちの思い', 'コンセプト',
    // 会社紹介
    '私たちについて', '当社について', '弊社について', 'our story', 'about us',
    // サービス・強み
    'サービス', 'service', 'メニュー', 'menu',
    '特徴', '強み', 'strength', 'feature', 'こだわり', '選ばれる理由',
    // 沿革・歴史
    '沿革', '歴史', 'history', '創業', '設立'
  ];

  function traverse(node: any) {
    if (isTag(node)) {
      const element = node as Element;

      // Check for anchor tags
      if (element.name === 'a' && element.attribs.href) {
        const href = element.attribs.href;
        const text = getElementText(element).toLowerCase();

        // Check if link text or href contains relevant keywords
        const isRelevant = relevantKeywords.some(kw =>
          text.includes(kw.toLowerCase()) || href.toLowerCase().includes(kw.toLowerCase())
        );

        if (isRelevant) {
          const fullUrl = resolveUrl(href, baseUrl);
          if (fullUrl && isSameDomain(fullUrl, baseUrl) && !fullUrl.includes('#')) {
            links.push(fullUrl);
          }
        }
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(document);

  // Remove duplicates and return
  return Array.from(new Set(links));
}

// Get text content from an element
function getElementText(element: Element): string {
  const textParts: string[] = [];

  function traverse(node: any) {
    if (isText(node)) {
      textParts.push(node.data.trim());
    }
    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(element);
  return textParts.join(' ');
}

// Resolve relative URL to absolute URL
function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    // If href is already absolute, return it
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }

    // Resolve relative URL
    const base = new URL(baseUrl);

    if (href.startsWith('/')) {
      // Absolute path
      return `${base.protocol}//${base.host}${href}`;
    } else if (href.startsWith('./')) {
      // Relative path
      const path = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
      return `${base.protocol}//${base.host}${path}${href.substring(2)}`;
    } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      // Relative path without ./
      const path = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
      return `${base.protocol}//${base.host}${path}${href}`;
    }

    return null;
  } catch {
    return null;
  }
}

// Check if two URLs are from the same domain
function isSameDomain(url1: string, url2: string): boolean {
  try {
    const domain1 = new URL(url1).hostname;
    const domain2 = new URL(url2).hostname;
    return domain1 === domain2;
  } catch {
    return false;
  }
}

export interface SalesLetterRequest {
  company_url?: string;
  companyUrl?: string;
  url?: string;
  text?: string;
  companyInfo?: string;
  company_info?: string;
  companyName?: string;
  company_name?: string;
}

export interface SalesLetterResponse {
  ok: boolean;
  success?: boolean;
  // Lovable expected fields (backward compatibility)
  title?: string;
  text?: string;
  // Additional fields
  company_url?: string;
  companyName?: string;
  company_name?: string;
  companyInfo?: string;
  company_info?: string;
  description?: string;
  sales_letter?: string;
  salesLetter?: string;
  message?: string;
  error?: string;
  error_type?: string;
  received_params?: string[];
  analyzed?: boolean;
  contact_pages?: string[];
  contactPages?: string[];
  fax_numbers?: string[];
  faxNumbers?: string[];
}

export async function handleSalesLetter(
  request: Request
): Promise<Response> {
  try {
    let body: SalesLetterRequest;

    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({
          ok: false,
          success: false,
          title: 'エラー',
          text: 'リクエストのJSONが不正です',
          error: 'Invalid JSON in request body',
          message: 'リクエストのJSONが不正です',
          error_type: 'ParseError'
        } as SalesLetterResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log received parameters for debugging
    console.log('Received parameters:', Object.keys(body));

    // Support multiple parameter names for flexibility
    const companyUrl = body.company_url || body.companyUrl || body.url || '';
    const companyText = body.text || body.companyInfo || body.company_info || '';
    const companyName = body.companyName || body.company_name || '';

    // Accept if we have at least URL, text, or company name
    if (!companyUrl && !companyText && !companyName) {
      const errorResponse = {
        ok: false,
        success: false,
        title: 'エラー',
        text: 'パラメータが不足しています',
        error: 'At least one parameter is required: company_url/url, text/companyInfo, or companyName',
        message: 'パラメータが不足しています',
        received_params: Object.keys(body)
      };
      console.error('Missing required parameters:', errorResponse);
      return new Response(
        JSON.stringify(errorResponse as SalesLetterResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let finalCompanyName = companyName || '';
    let finalCompanyInfo = companyText || '';
    let analyzed = false;
    let pages: PageResult[] = [];
    let contactPages: string[] = [];
    let faxNumbers: string[] = [];

    // If URL is provided but no text, try to fetch and analyze the page
    if (companyUrl && !companyText) {
      console.log('Fetching and analyzing URL:', companyUrl);

      // Fetch multiple pages for deeper analysis
      pages = await fetchMultiplePages(companyUrl);

      if (pages.length > 0) {
        analyzed = true;

        // Extract company name from URL if not provided
        if (!finalCompanyName) {
          try {
            const urlObj = new URL(companyUrl);
            const domain = urlObj.hostname.replace(/^www\./, '');
            finalCompanyName = domain.split('.')[0];
          } catch {
            finalCompanyName = '御社';
          }
        }

        // Combine all HTML for deep analysis
        const combinedHtml = pages.map(p => p.html).join('\n\n');
        console.log(`Analyzing ${pages.length} pages`);

        // Deep analyze HTML content
        const deepAnalysis = performDeepAnalysis(combinedHtml, companyUrl);

        // Extract contact pages from all crawled pages
        const contactPagesSet = new Set<string>();
        const faxNumbersSet = new Set<string>();
        for (const page of pages) {
          const foundContactPages = extractContactPages(page.html, page.url, 5);
          foundContactPages.forEach(url => contactPagesSet.add(url));

          // Extract FAX numbers from each page
          const foundFaxNumbers = extractFaxNumbers(page.html);
          foundFaxNumbers.forEach(num => faxNumbersSet.add(num));
        }
        contactPages = Array.from(contactPagesSet);
        faxNumbers = Array.from(faxNumbersSet);
        console.log(`Found ${contactPages.length} contact pages:`, contactPages);
        console.log(`Found ${faxNumbers.length} FAX numbers:`, faxNumbers);

        // Use deep analysis result as company info
        finalCompanyInfo = JSON.stringify(deepAnalysis);
        console.log('Deep analysis complete:', deepAnalysis);
      } else {
        console.log('Failed to fetch URL: no pages retrieved');

        // Extract company name from URL even if fetch fails
        if (!finalCompanyName) {
          try {
            const urlObj = new URL(companyUrl);
            const domain = urlObj.hostname.replace(/^www\./, '');
            finalCompanyName = domain.split('.')[0];
          } catch {
            finalCompanyName = '御社';
          }
        }

        // Use fallback if fetch fails
        finalCompanyInfo = companyName || finalCompanyName || 'この企業';
        console.log('Using fallback. CompanyName:', finalCompanyName, 'CompanyInfo:', finalCompanyInfo);
      }
    } else {
      // Use provided text or company name as fallback
      finalCompanyInfo = companyText || companyName || 'この企業';
      if (!finalCompanyName && companyUrl) {
        try {
          const urlObj = new URL(companyUrl);
          const domain = urlObj.hostname.replace(/^www\./, '');
          finalCompanyName = domain.split('.')[0];
        } catch {
          finalCompanyName = '御社';
        }
      }
    }

    // Generate sales letter using Time Embassy template
    const topPageHtml = pages.length > 0 ? pages[0].html : '';
    const salesLetter = generateTimeEmbassySalesLetter(
      companyUrl || 'https://example.com',
      finalCompanyInfo,
      topPageHtml
    );

    // Return response with both camelCase and snake_case for compatibility
    // Ensure company_url is never empty string
    const finalCompanyUrl = companyUrl || 'https://example.com';

    const response: SalesLetterResponse = {
      ok: true,
      success: true,
      // Lovable expected fields (backward compatibility)
      title: finalCompanyName || '企業名',
      text: finalCompanyInfo,
      // Additional fields
      company_url: finalCompanyUrl,
      companyName: finalCompanyName || '企業名',
      company_name: finalCompanyName || '企業名',
      companyInfo: finalCompanyInfo,
      company_info: finalCompanyInfo,
      description: finalCompanyInfo,
      sales_letter: salesLetter,
      salesLetter: salesLetter,
      message: salesLetter,
      analyzed,
      contact_pages: contactPages,
      contactPages: contactPages,
      fax_numbers: faxNumbers,
      faxNumbers: faxNumbers,
      debug_pages_crawled: (pages && pages.length) || 0,
      debug_urls: pages ? pages.map(p => p.url) : []
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in handleSalesLetter:', error);
    console.error('Error stack:', error.stack);

    const errorResponse = {
      ok: false,
      success: false,
      title: 'エラー',
      text: 'HP解析中にエラーが発生しました: ' + (error.message || '不明なエラー'),
      error: error.message || 'Internal server error',
      error_type: error.name || 'Unknown',
      message: 'HP解析中にエラーが発生しました: ' + (error.message || '不明なエラー')
    };

    return new Response(
      JSON.stringify(errorResponse as SalesLetterResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function generateTimeEmbassySalesLetter(companyUrl: string, companyInfo: string, html?: string): string {
  // Extract company name from HTML title or URL
  const companyName = extractCompanyName(companyUrl, html);

  // Try to parse deep analysis JSON first
  let context: any;
  try {
    const deepAnalysis = JSON.parse(companyInfo);
    context = generateContextFromDeepAnalysis(deepAnalysis);
  } catch {
    // Fallback to simple analysis
    context = analyzeCompanyInfo(companyInfo);
  }

  const salesLetter = `ご担当者様

突然のご連絡を失礼いたします。
Time Embassy（タイム・エンバシー / timeembassy.com）を運営しております、福島と申します。

御社の公式サイトを拝見し、${context.attraction}という点に強く惹かれ、ご連絡いたしました。

特に、
${context.uniqueApproach}
という姿勢に、他にはない価値を感じています。

現在、
「海外に伝えるべき日本の企業文化」をテーマに、
約100社ほどの事例を集めているところです。

Time Embassy は、
歴史上の人物の視点を通して、
日本の企業や文化を海外に紹介する
非営利の文化プロジェクトです。
掲載費・参加費などは一切かかりません。

これまでに、
AP通信、Fox News、CBS、ABC などの海外メディアでも
本プロジェクトの取り組みが紹介されてきました。

そこで本日は、
御社に一つご提案がございます。

【歴史上の人物が御社のアンバサダーとなる】

これは、歴史上の人物の視点を通して、
御社の価値観や事業の本質を、
海外に向けて発信するという試みです。

例えば、
御社の${context.businessType}としての姿勢を、
歴史上の偉人が自らの言葉で語ることで、

・日本の企業文化の深さ
・${context.businessType}が持つ社会的意義
・御社独自の価値観

これらが、より深く、普遍的な形で
海外の方々に伝わるのではないかと考えております。

少しイメージしやすいよう、
もし歴史上の人物が御社について語るとしたら、
どのような表現になるか、
ごく短い試作を作ってみました。

――――――――――
（参考・試作文）

${context.historicalNarrative}

――――――――――

御社の事業や価値観にふさわしい
歴史上の人物の視点として、
以下の3名を候補として考えてみました。

${formatHistoricalFigures(context.historicalFigures)}

これらの中で、
御社の想いや価値観に最も近いと感じられる方、
あるいは、
別の視点をお持ちの場合は、
その点もぜひお聞かせいただけますでしょうか。

また、
さらに深い内容をご希望の場合は、
有料とはなりますが、

【社長様と歴史上の人物との対談】

という形式も可能です。

これは、歴史上の人物が
御社の理念や事業について社長様に質問を投げかけ、
その対話を通じて、
御社の本質をより深く引き出すという試みです。

このような方向性で、

・海外にどう伝えるのが自然か
・どの切り口がふさわしいか
・誤解されやすい点はどこか

について、
一度、短い意見交換のお時間をいただけないでしょうか。

15〜20分ほどのオンラインで構いません。
ご負担のない範囲で、
御社のお考えをお聞かせいただけましたら幸いです。

ご検討いただけましたら、
ご都合のよい日時をいくつかお知らせいただけますでしょうか。

何卒よろしくお願いいたします。

――――――――――
Time Embassy
株式会社SRB
福島
TEL: 080-4389-3020
Email: info@cloneshacho.com
――――――――――`;

  return salesLetter;
}

function formatHistoricalFigures(figures: any[]): string {
  if (!figures || figures.length === 0) {
    return '（歴史上の人物の候補を検討中です）';
  }

  return figures.map((figure, index) => {
    return `
【候補${index + 1}】${figure.name}（${figure.period}）
・選定理由：${figure.reason}
`;
  }).join('\n');
}

function extractCompanyName(url: string, html?: string): string {
  // Try to extract from HTML title first
  if (html) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      let title = titleMatch[1].trim();

      // Remove common suffixes and separators
      title = title
        .replace(/\s*[-|｜]\s*(ホーム|HOME|トップ|TOP|公式サイト|公式ホームページ|オフィシャルサイト).*$/i, '')
        .replace(/\s*(ホーム|HOME|トップ|TOP|公式サイト|公式ホームページ|オフィシャルサイト)\s*[-|｜]\s*/i, '')
        .trim();

      // If title contains company-like words and is reasonable length, use it
      if (title.length > 2 && title.length < 50 &&
          (title.match(/株式会社|有限会社|合同会社|社団法人|財団法人|[ぁ-んァ-ヶ一-龠]+/) ||
           title.match(/Co\.,?\s*Ltd|Corporation|Inc\.|LLC/i))) {
        return title;
      }
    }
  }

  // Fallback: extract from URL
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    // Return the main domain name (e.g., "toyota" from "toyota.com")
    return parts[0];
  } catch {
    return '貴社';
  }
}

interface CompanyContext {
  attraction: string;
  uniqueApproach: string;
  businessType: string;
  historicalNarrative: string;
  historicalFigures: HistoricalFigure[];
}

function analyzeCompanyInfo(info: string): CompanyContext {
  // Default context
  const context: CompanyContext = {
    attraction: '事業を営むということは、単に利益を追求することではない。この地という場所で、人々の暮らしに寄り添い、社会に価値を提供し続けること。その積み重ねこそが、真の事業の在り方だと考えておられる',
    uniqueApproach: '短期的な成果ではなく、地域社会との長期的な関係を大切にし、持続可能な価値創造を目指されている',
    businessType: '企業',
    historicalNarrative: '「事業とは、単に利益を追求するものではない。この地で、人々の暮らしに寄り添い、社会に価値を提供し続けること。それこそが真の事業の在り方である」',
    historicalFigures: []
  };

  // Simple keyword-based analysis
  const lowerInfo = info.toLowerCase();

  // Detect business type and set appropriate content
  if (lowerInfo.includes('マッサージ') || lowerInfo.includes('もみほぐし') || lowerInfo.includes('整体') || lowerInfo.includes('リンパケア')) {
    context.businessType = 'マッサージ・整体';
    context.attraction = '人の体に触れるということは、単なる技術の問題ではない。相手の抱える痛みや疲れに真摯に向き合い、一人ひとりの体が本来持っている健やかさを取り戻そうとする、静かな決意がある。この地で、そうした施術に真剣に取り組んでおられる';
    context.uniqueApproach = '目に見えない「体の声」に耳を傾け、一人ひとりの状態に合わせた施術を大切にされている';
    context.historicalNarrative = '「癒やしとは、ただ痛みを取り除くことではない。心と体の両方に働きかけ、その人本来の健やかさを取り戻すこと。丁寧に、真摯に、一人ひとりの体に向き合う。それこそが真の癒やしなのだ」';
  } else if (lowerInfo.includes('美容') || lowerInfo.includes('エステ') || lowerInfo.includes('美容室') || lowerInfo.includes('ヘアサロン')) {
    context.businessType = '美容業';
    context.attraction = '美しさというのは、決して表面的なものではない。一人ひとりが本来持っている魅力を引き出し、その人らしさを大切にしながら、心と体の調和を目指していく。そんな美容の本質を、この地で静かに追求しておられる';
    context.uniqueApproach = '画一的な美しさではなく、その人だけが持つ個性や魅力を大切に、内面からの美しさを引き出そうとされている';
    context.historicalNarrative = '「美しさとは、ただ外見を整えることではない。その人本来の魅力を引き出し、心と体が調和したとき、真の美しさが生まれる。一人ひとりに寄り添い、その人らしさを大切にする。それが真の美容である」';
  } else if (lowerInfo.includes('飲食') || lowerInfo.includes('レストラン') || lowerInfo.includes('食堂')) {
    context.businessType = '飲食店';
    context.attraction = '食べることは、ただ空腹を満たすという単純な行為ではない。そこには作り手の想いがあり、この土地の文化があり、人と人とのつながりがある。そうした「食」の持つ深い意味を、日々の営みの中で大切にしておられる';
    context.uniqueApproach = '効率や利益を追うのではなく、一皿一皿に込める想いと、お客様との心の通い合いを何より大切にされている';
    context.historicalNarrative = '「この店の味は、ただ腹を満たすためのものではない。人と人が集い、語らい、絆を深める場所。それこそが真の「もてなし」なのだ」';
  } else if (lowerInfo.includes('宿泊') || lowerInfo.includes('旅館') || lowerInfo.includes('ホテル')) {
    context.businessType = '宿泊施設';
    context.attraction = '旅人を迎えるということは、単に部屋と食事を提供することではない。この場所の持つ物語を伝え、訪れる人々に新たな気づきをもたらす。そんな「もてなし」の本質を、静かに実践しておられる';
    context.uniqueApproach = 'マニュアル的なサービスではなく、その時その場で最適な心配りをし、お客様一人ひとりと真摯に向き合おうとされている';
    context.historicalNarrative = '「旅の疲れを癒やすだけでなく、その土地の物語を伝える。それが真の「宿」の役割である」';
  } else if (lowerInfo.includes('製造') || lowerInfo.includes('工場') || lowerInfo.includes('メーカー')) {
    context.businessType = '製造業';
    context.attraction = 'ものを作るということは、単に製品を生み出す作業ではない。この地で培われた技術と、作り手の誇りを形にし、それを次の世代へと受け継いでいく。そんな「ものづくり」の本質に、真剣に向き合っておられる';
    context.uniqueApproach = '効率や量産を追うのではなく、一つ一つの製品に職人の技と心を込め、品質と信頼を何より大切にされている';
    context.historicalNarrative = '「ものづくりとは、単に製品を作ることではない。職人の技と心を、次の世代へと受け継ぐことなのだ」';
  } else if (lowerInfo.includes('小売') || lowerInfo.includes('商店') || lowerInfo.includes('店舗')) {
    context.businessType = '小売業';
    context.attraction = '商いを営むということは、単に品物を売ることではない。人と人とをつなぎ、地域を支える営みとして、日々のお客様との関係を大切にしておられる';
    context.uniqueApproach = '売上を追うのではなく、お客様との信頼関係と、地域に根ざした商いを何より大切にされている';
    context.historicalNarrative = '「商いとは、品物を売ることではない。人と人とをつなぎ、地域を支える営みなのだ」';
  }

  // 歴史上の人物を必ず設定する
  context.historicalFigures = suggestHistoricalFigures(
    context.businessType,
    '',  // philosophy
    [],  // uniqueStrengths
    ''   // location
  );

  return context;
}
