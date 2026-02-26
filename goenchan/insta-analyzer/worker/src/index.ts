import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Env = {
  REPORTS: KVNamespace;
  UPLOAD_SECRET: string;
  ANTHROPIC_API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*' }));

// Root redirect to Pages site
app.get('/', (c) => c.redirect('https://insta-analyzer.pages.dev'));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// ---------- Instagram Scraping ----------

interface ScrapedPost {
  shortcode: string;
  imgSrc: string;
  caption: string;
  likes: number;
  comments: number;
  timestamp: string;
  isVideo: boolean;
}

interface ScrapedProfile {
  username: string;
  fullName: string;
  bio: string;
  profilePic: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isVerified: boolean;
  posts: ScrapedPost[];
}

async function scrapeInstagram(username: string): Promise<ScrapedProfile> {
  // Try fetching Instagram profile page and extracting data from embedded JSON
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'no-cache',
  };

  // Method 1: Try the web profile info API
  try {
    const apiUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        ...headers,
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (apiRes.ok) {
      const json: any = await apiRes.json();
      const user = json?.data?.user;
      if (user) {
        return extractProfileFromGraphQL(user);
      }
    }
  } catch {}

  // Method 2: Fetch the profile HTML and extract __additionalDataLoaded or shared_data
  const profileUrl = `https://www.instagram.com/${username}/`;
  const res = await fetch(profileUrl, { headers });

  if (!res.ok) {
    throw new Error(`Instagram returned ${res.status}. The account may not exist or is private.`);
  }

  const html = await res.text();

  // Try to extract JSON from various script patterns
  const patterns = [
    /window\.__additionalDataLoaded\s*\(\s*['"][^'"]*['"]\s*,\s*({.+?})\s*\)\s*;/s,
    /window\._sharedData\s*=\s*({.+?})\s*;/s,
    /<script type="application\/json"[^>]*data-content-len[^>]*>({.+?})<\/script>/s,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const user = data?.graphql?.user
          || data?.entry_data?.ProfilePage?.[0]?.graphql?.user
          || data?.data?.user;
        if (user) {
          return extractProfileFromGraphQL(user);
        }
      } catch {}
    }
  }

  // Method 3: Extract basic info from meta tags as fallback
  return extractFromMetaTags(html, username);
}

function extractProfileFromGraphQL(user: any): ScrapedProfile {
  const edges = user.edge_owner_to_timeline_media?.edges || [];
  const posts: ScrapedPost[] = edges.slice(0, 24).map((edge: any) => {
    const node = edge.node;
    return {
      shortcode: node.shortcode || '',
      imgSrc: node.display_url || node.thumbnail_src || '',
      caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
      likes: node.edge_liked_by?.count || node.edge_media_preview_like?.count || 0,
      comments: node.edge_media_to_comment?.count || 0,
      timestamp: node.taken_at_timestamp
        ? new Date(node.taken_at_timestamp * 1000).toISOString()
        : '',
      isVideo: node.is_video || false,
    };
  });

  return {
    username: user.username || '',
    fullName: user.full_name || '',
    bio: user.biography || '',
    profilePic: user.profile_pic_url_hd || user.profile_pic_url || '',
    followerCount: user.edge_followed_by?.count || 0,
    followingCount: user.edge_follow?.count || 0,
    postCount: user.edge_owner_to_timeline_media?.count || 0,
    isVerified: user.is_verified || false,
    posts,
  };
}

function extractFromMetaTags(html: string, username: string): ScrapedProfile {
  const getMetaContent = (property: string): string => {
    const match = html.match(new RegExp(`<meta[^>]*property="${property}"[^>]*content="([^"]*)"`, 'i'))
      || html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*property="${property}"`, 'i'));
    return match ? match[1] : '';
  };

  const description = getMetaContent('og:description') || getMetaContent('description');
  const title = getMetaContent('og:title') || '';
  const image = getMetaContent('og:image') || '';

  // Parse follower count from description like "12.5K Followers, 500 Following, 245 Posts"
  let followerCount = 0;
  let followingCount = 0;
  let postCount = 0;

  const followerMatch = description.match(/([\d,.]+[KMB]?)\s*Followers/i);
  const followingMatch = description.match(/([\d,.]+[KMB]?)\s*Following/i);
  const postMatch = description.match(/([\d,.]+[KMB]?)\s*Posts/i);

  if (followerMatch) followerCount = parseCount(followerMatch[1]);
  if (followingMatch) followingCount = parseCount(followingMatch[1]);
  if (postMatch) postCount = parseCount(postMatch[1]);

  // Extract bio from description (after the stats)
  const bio = description.replace(/[\d,.]+[KMB]?\s*(Followers|Following|Posts)\s*[-,]\s*/gi, '').trim();

  return {
    username,
    fullName: title.replace(/\s*\(@[^)]+\).*$/, '').trim(),
    bio,
    profilePic: image,
    followerCount,
    followingCount,
    postCount,
    isVerified: false,
    posts: [],
  };
}

function parseCount(str: string): number {
  str = str.replace(/,/g, '');
  const num = parseFloat(str);
  if (str.endsWith('K') || str.endsWith('k')) return Math.round(num * 1000);
  if (str.endsWith('M') || str.endsWith('m')) return Math.round(num * 1000000);
  if (str.endsWith('B') || str.endsWith('b')) return Math.round(num * 1000000000);
  return Math.round(num) || 0;
}

// POST /api/scrape - Scrape Instagram profile
app.post('/api/scrape', async (c) => {
  let body: { username?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const username = body.username?.replace(/^@/, '').trim();
  if (!username || !/^[A-Za-z0-9_.]{1,30}$/.test(username)) {
    return c.json({ error: '無効なユーザー名です' }, 400);
  }

  try {
    const data = await scrapeInstagram(username);
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ error: err.message || 'スクレイピングに失敗しました' }, 500);
  }
});

// ---------- AI Analysis ----------

const ANALYSIS_PROMPT = `あなたはInstagramアカウント分析の専門家です。以下のデータを分析し、JSONで結果を出力してください。

## 分析要件

### 分析シート（9カテゴリ）
1. **accountOverview**: フォロワー数、フォロー比率、投稿頻度、成長ポテンシャル、総合スコア(S/A/B/C/D)
2. **visualConsistency**: 色調パレット(HEX 5色)、統一感スコア(A-F)、トーン、フィルター一貫性
3. **contentClassification**: カテゴリ比率(%)、バランス評価、不足タイプ
4. **photoQuality**: スコア(A-F)、構図、照明、被写体明確さ、プロ度
5. **engagement**: いいね率、コメント率、ベスト3/ワースト3投稿と理由、タイプ別パフォーマンス
6. **postingTiming**: 頻度、安定性、最適タイミング、パターン
7. **captionAnalysis**: 平均文字数、CTA使用率(%)、ハッシュタグ戦略、トーン
8. **branding**: 一貫性スコア(A-F)、ペルソナ明確さ、差別化ポイント、世界観
9. **continuity**: 投稿間隔安定性、進化トレンド、飽きられリスク(低/中/高)、トレンド適応

### 提案シート（6カテゴリ）
1. **quickWins**: 即効性施策(title, description, impact高/中/低, effort高/中/低)
2. **contentStrategy**: コンテンツ戦略提案
3. **visualImprovement**: ビジュアル改善案
4. **engagementBoost**: エンゲージメント向上策
5. **followerAcquisition**: フォロワー獲得戦略
6. **threeMonthRoadmap**: 3ヶ月ロードマップ(month1-3: focus, kpi, actions[])

## 重要な注意
- 各投稿のキャプション内容、エンゲージメント数から深い洞察を導く
- 投稿の画像URLがある場合、URLのパターンや数から投稿の傾向を分析
- 提案は具体的で実行可能なものにする
- 日本語で全て記述
- JSONのみ出力（説明文不要）

## 出力JSON形式
{
  "analysis": {
    "accountOverview": { "username":"", "followerCount":0, "followingCount":0, "postCount":0, "followRatio":0, "postFrequency":"", "growthPotential":"", "overallScore":"" },
    "visualConsistency": { "score":"", "colorPalette":["#xxx"], "dominantTone":"", "filterConsistency":"", "gridCohesion":"", "details":"" },
    "contentClassification": { "categories":[{"name":"","percentage":0,"description":""}], "balanceAssessment":"", "missingTypes":[] },
    "photoQuality": { "score":"", "composition":"", "lighting":"", "subjectClarity":"", "professionalismLevel":"", "details":"" },
    "engagement": { "avgLikeRate":0, "avgCommentRate":0, "bestPosts":[{"index":0,"reason":"","likes":0,"comments":0}], "worstPosts":[{"index":0,"reason":"","likes":0,"comments":0}], "performanceByType":[{"type":"","avgLikes":0,"avgComments":0}] },
    "postingTiming": { "frequency":"", "stabilityScore":"", "optimalTiming":"", "pattern":"" },
    "captionAnalysis": { "avgLength":0, "ctaUsageRate":0, "hashtagStrategy":{"avgCount":0,"relevance":"","competitiveness":""}, "toneOfVoice":"" },
    "branding": { "consistencyScore":"", "personaClarity":"", "differentiationPoints":[], "worldView":"" },
    "continuity": { "intervalStability":"", "contentEvolution":"", "fatigueRisk":"", "trendAdaptation":"" }
  },
  "proposals": {
    "quickWins": [{"title":"","description":"","impact":"","effort":""}],
    "contentStrategy": [{"title":"","description":""}],
    "visualImprovement": [{"title":"","description":""}],
    "engagementBoost": [{"title":"","description":""}],
    "followerAcquisition": [{"title":"","description":""}],
    "threeMonthRoadmap": {
      "month1": {"focus":"","kpi":"","actions":[]},
      "month2": {"focus":"","kpi":"","actions":[]},
      "month3": {"focus":"","kpi":"","actions":[]}
    }
  }
}`;

// POST /api/analyze - Analyze scraped data with Claude
app.post('/api/analyze', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500);
  }

  let body: { username?: string; scrapeData?: ScrapedProfile };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const { username, scrapeData } = body;
  if (!username || !scrapeData) {
    return c.json({ error: 'Missing username or scrapeData' }, 400);
  }

  // Build the data summary for Claude
  const dataSummary = JSON.stringify({
    username: scrapeData.username,
    fullName: scrapeData.fullName,
    bio: scrapeData.bio,
    followerCount: scrapeData.followerCount,
    followingCount: scrapeData.followingCount,
    postCount: scrapeData.postCount,
    isVerified: scrapeData.isVerified,
    posts: scrapeData.posts.map((p, i) => ({
      index: i,
      caption: p.caption.substring(0, 500),
      likes: p.likes,
      comments: p.comments,
      timestamp: p.timestamp,
      isVideo: p.isVideo,
      hasImage: !!p.imgSrc,
    })),
  }, null, 2);

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': c.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: `${ANALYSIS_PROMPT}\n\n## 分析対象データ\n\n\`\`\`json\n${dataSummary}\n\`\`\`\n\nJSONのみ出力してください。`,
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('Claude API error:', errText);
      return c.json({ error: 'AI分析に失敗しました' }, 500);
    }

    const claudeData: any = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '';

    // Extract JSON from response (might be wrapped in ```json blocks)
    let reportJson: any;
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/({[\s\S]*})/);
    if (jsonMatch) {
      reportJson = JSON.parse(jsonMatch[1]);
    } else {
      reportJson = JSON.parse(rawText);
    }

    // Generate secret code and store
    const secretCode = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const storeValue = JSON.stringify({
      username,
      report: reportJson,
      profile: {
        username: scrapeData.username,
        scrapedAt: new Date().toISOString(),
        postCount: scrapeData.posts.length,
      },
      createdAt: new Date().toISOString(),
    });

    await c.env.REPORTS.put(`report:${secretCode}`, storeValue, {
      expirationTtl: 172800,
    });

    return c.json({ success: true, secretCode });
  } catch (err: any) {
    console.error('Analysis error:', err);
    return c.json({ error: 'AI分析に失敗しました: ' + (err.message || 'unknown error') }, 500);
  }
});

// ---------- Existing Endpoints ----------

// Upload report (from local CLI)
app.post('/api/upload', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || authHeader !== `Bearer ${c.env.UPLOAD_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: { secretCode?: string; username?: string; report?: unknown; profile?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { secretCode, username, report, profile } = body;

  if (!secretCode || !username || !report || !profile) {
    return c.json({ error: 'Missing required fields: secretCode, username, report, profile' }, 400);
  }

  await c.env.REPORTS.put(
    `report:${secretCode}`,
    JSON.stringify({
      username,
      report,
      profile,
      createdAt: new Date().toISOString(),
    }),
    { expirationTtl: 172800 }
  );

  return c.json({ success: true, secretCode });
});

// Get report by code
app.get('/api/report/:code', async (c) => {
  const code = c.req.param('code');
  const data = await c.env.REPORTS.get(`report:${code}`);

  if (!data) {
    return c.json({ error: 'Report not found or expired' }, 404);
  }

  return c.json(JSON.parse(data));
});

export default app;
