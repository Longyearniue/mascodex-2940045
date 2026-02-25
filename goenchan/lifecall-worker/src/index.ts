import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sessions } from './session';
import { payment } from './payment';
import { calling } from './calling';
import { search } from './search';
import { telnyxWebhook } from './webhooks/telnyx';
import lifecallJs from './static/lifecall.txt';

type Env = {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_SECRET: string;
  PAYPAL_MODE: string;
  TELNYX_API_KEY: string;
  TELNYX_CONNECTION_ID: string;
  TELNYX_FROM_NUMBER: string;
  GOOGLE_PLACES_API_KEY: string;
  CORS_ORIGIN: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*' }));

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Life Call Concierge | Mascodex</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Noto Sans JP',sans-serif;background:#0f0c29;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;}
    .container{max-width:600px;padding:40px 24px;text-align:center;}
    .logo{font-weight:800;font-size:2rem;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px;}
    .subtitle{color:rgba(255,255,255,0.5);font-size:1rem;margin-bottom:40px;}
    h2{font-size:1.4rem;font-weight:700;margin-bottom:16px;color:rgba(255,255,255,0.9);}
    p{color:rgba(255,255,255,0.65);line-height:1.8;font-size:0.95rem;margin-bottom:24px;}
    .tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:32px;}
    .tier{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px 12px;}
    .tier .price{font-size:1.3rem;font-weight:800;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .tier .label{font-size:0.75rem;color:rgba(255,255,255,0.4);margin-top:6px;}
    .tier .examples{font-size:0.8rem;color:rgba(255,255,255,0.55);margin-top:10px;line-height:1.5;}
    .cta{display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:30px;color:#fff;text-decoration:none;font-weight:700;font-size:1rem;transition:opacity 0.2s;}
    .cta:hover{opacity:0.85;}
    .footer{margin-top:40px;color:rgba(255,255,255,0.2);font-size:0.75rem;}
    .status{display:inline-block;background:rgba(102,234,126,0.15);color:rgba(102,234,126,0.9);padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:600;margin-bottom:24px;}
    @media(max-width:500px){.tiers{grid-template-columns:1fr;}.tier{padding:16px;}}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Life Call</div>
    <div class="subtitle">by Mascodex</div>
    <div class="status">API Online</div>
    <h2>面倒な電話、全部やります。</h2>
    <p>ゆるキャラに話しかけるだけで、AIが業者・施設に電話代行。病院予約、引越し見積、水漏れ修理まで20カテゴリ対応。</p>
    <div class="tiers">
      <div class="tier">
        <div class="price">&yen;500</div>
        <div class="label">シンプル予約</div>
        <div class="examples">病院・歯医者<br>レストラン<br>カラオケ</div>
      </div>
      <div class="tier">
        <div class="price">&yen;1,500</div>
        <div class="label">比較・交渉</div>
        <div class="examples">引越し見積<br>エアコン修理<br>不用品回収</div>
      </div>
      <div class="tier">
        <div class="price">&yen;3,000</div>
        <div class="label">緊急・解約</div>
        <div class="examples">水漏れ修理<br>鍵紛失<br>サブスク解約</div>
      </div>
    </div>
    <a href="https://mascodex.com/" class="cta">ゆるキャラと話す</a>
    <div class="footer">&copy; 2025 Mascodex. AI電話代行サービス。医療・法律の助言は行いません。</div>
  </div>
</body>
</html>`);
});

app.get('/health', (c) => c.json({ ok: true, service: 'lifecall-worker' }));

app.get('/js/lifecall.js', (c) => {
  return c.body(lifecallJs, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  });
});

app.route('/api/sessions', sessions);
app.route('/api/payment', payment);
app.route('/api/calls', calling);
app.route('/api/search', search);
app.route('/webhooks/telnyx-voice', telnyxWebhook);

export default app;
