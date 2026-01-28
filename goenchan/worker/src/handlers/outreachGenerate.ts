import { handleFounderVisibility } from './founderVisibility';

export interface OutreachGenerateRequest {
  companyName: string;
  url: string;
  questions: string;
}

export interface OutreachGenerateResponse {
  eligible: boolean;
  subject?: string;
  body?: string;
  evidence?: string[];
  reason?: string;
}

export async function handleOutreachGenerate(
  request: Request
): Promise<Response> {
  try {
    const body: OutreachGenerateRequest = await request.json();

    if (!body.companyName || !body.url || !body.questions) {
      return new Response(
        JSON.stringify({
          error: 'companyName, url, and questions are required'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Check founder visibility
    const visibilityRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: body.url }),
    });

    const visibilityResponse = await handleFounderVisibility(visibilityRequest);
    const visibilityData = await visibilityResponse.json();

    // Step 2: If not eligible, return early
    if (!visibilityData.founder_visibility) {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: 'founder_visibility_false',
        } as OutreachGenerateResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Generate email content
    const subject = 'ライブ配信出演のご相談（Goenchan）';

    const emailBody = `${body.companyName}の皆様

お世話になります。Goenchanの和田と申します。

貴社のウェブサイトを拝見し、創業者様・経営者様のメッセージやビジョンに大変感銘を受けました。

Goenchanでは、革新的な企業のトップの方々をお招きし、創業の背景や今後の展望についてお話しいただくライブ配信を企画しております（https://goenchan.com）。

視聴者からの以下の質問にもお答えいただければと考えております：
${body.questions}

ぜひ貴社の創業ストーリーや${body.companyName}ならではの取り組みについてお聞かせいただけませんでしょうか。

ご興味をお持ちいただけましたら、日程調整などの詳細についてご相談させていただければ幸いです。

何卒よろしくお願いいたします。

Goenchan 和田
https://goenchan.com`;

    const response: OutreachGenerateResponse = {
      eligible: true,
      subject,
      body: emailBody,
      evidence: visibilityData.evidence,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
