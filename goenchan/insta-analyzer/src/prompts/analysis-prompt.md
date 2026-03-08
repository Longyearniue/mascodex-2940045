# Instagram アカウント分析プロンプト

以下の手順でInstagramアカウントの包括的分析を行い、JSON形式のレポートを生成してください。

---

## 前提

- スクレイパーが `data/<username>/` ディレクトリに以下のファイルを出力済みです:
  - `profile.json` — プロフィール情報、各投稿のいいね数・コメント数・キャプション・タイムスタンプ
  - `images/post_00.jpg` ～ `images/post_23.jpg` — 最新24件の投稿画像

---

## ステップ1: データ読み込み

1. `data/<username>/profile.json` を読み込み、以下を把握してください:
   - `username` — ユーザー名
   - `profile.stats` — フォロワー数、フォロー数、投稿数
   - `posts` 配列 — 各投稿の `likes`, `comments`, `caption`, `timestamp`, `index`
2. `data/<username>/images/` ディレクトリ内の画像ファイルを **1枚ずつすべて** 読み込んでください:
   - `post_00.jpg`, `post_01.jpg`, `post_02.jpg`, ... `post_23.jpg`
   - 各画像のビジュアル要素（構図、色調、被写体、テキスト、ブランド要素など）を詳細に観察してください
   - 存在しないファイル番号はスキップしてください（24件未満の場合があります）

---

## ステップ2: 分析（9カテゴリ）

以下の9カテゴリについて深く分析してください。画像のビジュアル情報とprofile.jsonのエンゲージメントデータを **必ずクロスリファレンス** して分析します。

### 2-1. アカウント概要 (accountOverview)
- フォロワー数、フォロー数、投稿数、フォロー比率を算出
- 投稿頻度をタイムスタンプから計算（例: 「週3回」）
- 成長ポテンシャルを定性的に評価
- 総合スコアをS/A/B/C/D（+/-付き可）で判定

### 2-2. ビジュアル一貫性 (visualConsistency)
- **全24枚の画像を見て**、グリッド全体のビジュアル統一感を評価
- 支配的なカラーパレット（HEXコード3色以上）を抽出
- 色温度の傾向（暖色系/寒色系/ニュートラル）
- フィルターや加工の統一性
- グリッドとして並べた時の視覚的まとまり
- スコアをS/A/B/C/Dで判定

### 2-3. コンテンツ分類 (contentClassification)
- 全投稿を画像とキャプションから内容別に分類（商品紹介、ライフスタイル、教育、UGC、プロモーションなど）
- 各カテゴリの割合（%）を算出
- コンテンツミックスのバランスを評価
- 欠落しているコンテンツタイプを指摘

### 2-4. 写真クオリティ (photoQuality)
- **各画像の構図**（三分割法、対称性、余白の使い方）
- **ライティング**（自然光/人工光、露出、影の質）
- **被写体の鮮明さ**（フォーカス、ボケ、ブレ）
- プロフェッショナリズムのレベル（素人/セミプロ/プロ/ハイエンド）
- スコアをS/A/B/C/D（+/-付き可）で判定

### 2-5. エンゲージメント分析 (engagement)
- 平均いいね率 = 平均いいね数 / フォロワー数 * 100
- 平均コメント率 = 平均コメント数 / フォロワー数 * 100
- **ベスト投稿**: エンゲージメントが高い投稿TOP3を特定し、**その画像のビジュアル特徴と何が効果的だったか**を説明
- **ワースト投稿**: エンゲージメントが低い投稿TOP3を特定し、**改善点**を指摘
- コンテンツタイプ別の平均エンゲージメントを算出

### 2-6. 投稿タイミング (postingTiming)
- タイムスタンプから投稿頻度を分析
- 投稿間隔の安定性
- 最適な投稿タイミングの推定
- 投稿パターンの傾向

### 2-7. キャプション分析 (captionAnalysis)
- 平均文字数
- CTA（行動喚起）の使用率（%）
- ハッシュタグ戦略（平均数、関連性、競合レベル）
- 文体・トーン（カジュアル/フォーマル/教育的/感情的など）

### 2-8. ブランディング (branding)
- ビジュアルとキャプションの一貫性スコア（S/A/B/C/D）
- ペルソナの明確さ
- 差別化ポイント
- 世界観の構築度

### 2-9. 継続性 (continuity)
- 投稿間隔の安定性
- コンテンツの進化・変化
- 「ネタ切れ」リスクの評価（低/中/高）
- トレンドへの適応力

---

## ステップ3: 改善提案 (proposals)

分析結果を基に、以下の5セクション + 3ヶ月ロードマップを作成してください:

### 3-1. クイックウィン (quickWins)
- すぐに実行可能で効果が高い施策を3～5件
- 各施策に impact（高/中/低）と effort（高/中/低）を付与

### 3-2. コンテンツ戦略 (contentStrategy)
- コンテンツミックスの改善案
- 新しいコンテンツシリーズの提案

### 3-3. ビジュアル改善 (visualImprovement)
- グリッドの統一感向上のための具体策
- 写真撮影・編集のアドバイス

### 3-4. エンゲージメントブースト (engagementBoost)
- いいね・コメントを増やすための施策
- ストーリーズやリールとの連携案

### 3-5. フォロワー獲得 (followerAcquisition)
- 新規フォロワー獲得のための具体策
- コラボレーション・タグ戦略

### 3-6. 3ヶ月ロードマップ (threeMonthRoadmap)
- 月ごとの重点テーマ、KPI目標、具体的アクションリスト

---

## ステップ4: JSON出力

分析結果を以下のJSON構造で **JSONのみ** 出力してください。説明文やマークダウンは不要です。
出力されたJSONをそのまま `report.json` としてコピーペーストできるようにしてください。

**重要**: 日本語で記述してください。数値フィールドは数値型で出力してください。

```json
{
  "analysis": {
    "accountOverview": {
      "username": "ユーザー名",
      "followerCount": 0,
      "followingCount": 0,
      "postCount": 0,
      "followRatio": 0.0,
      "postFrequency": "週X回",
      "growthPotential": "成長ポテンシャルの説明",
      "overallScore": "B+"
    },
    "visualConsistency": {
      "score": "B",
      "colorPalette": ["#xxxxxx", "#xxxxxx", "#xxxxxx"],
      "dominantTone": "暖色系/寒色系/ニュートラル",
      "filterConsistency": "フィルター統一性の評価",
      "gridCohesion": "グリッドとしてのまとまり評価",
      "details": "詳細分析テキスト"
    },
    "contentClassification": {
      "categories": [
        { "name": "カテゴリ名", "percentage": 40, "description": "説明" }
      ],
      "balanceAssessment": "コンテンツバランスの総合評価",
      "missingTypes": ["不足しているコンテンツタイプ"]
    },
    "photoQuality": {
      "score": "B+",
      "composition": "構図の評価",
      "lighting": "ライティングの評価",
      "subjectClarity": "被写体鮮明度の評価",
      "professionalismLevel": "素人/セミプロ/プロ/ハイエンド",
      "details": "詳細分析テキスト"
    },
    "engagement": {
      "avgLikeRate": 3.5,
      "avgCommentRate": 0.2,
      "bestPosts": [
        { "index": 0, "reason": "高エンゲージメントの理由（ビジュアル特徴含む）", "likes": 500, "comments": 20 }
      ],
      "worstPosts": [
        { "index": 5, "reason": "低エンゲージメントの理由と改善点", "likes": 50, "comments": 2 }
      ],
      "performanceByType": [
        { "type": "コンテンツタイプ名", "avgLikes": 300, "avgComments": 10 }
      ]
    },
    "postingTiming": {
      "frequency": "週X回",
      "stabilityScore": "安定/やや不安定/不安定",
      "optimalTiming": "推定最適投稿タイミング",
      "pattern": "投稿パターンの説明"
    },
    "captionAnalysis": {
      "avgLength": 150,
      "ctaUsageRate": 30,
      "hashtagStrategy": {
        "avgCount": 15,
        "relevance": "高い/普通/低い",
        "competitiveness": "高/中/低"
      },
      "toneOfVoice": "文体の特徴"
    },
    "branding": {
      "consistencyScore": "B",
      "personaClarity": "ペルソナ明確度の説明",
      "differentiationPoints": ["差別化ポイント1", "差別化ポイント2"],
      "worldView": "世界観の説明"
    },
    "continuity": {
      "intervalStability": "投稿間隔安定性の説明",
      "contentEvolution": "コンテンツ進化の説明",
      "fatigueRisk": "低/中/高",
      "trendAdaptation": "トレンド適応力の説明"
    }
  },
  "proposals": {
    "quickWins": [
      { "title": "施策タイトル", "description": "具体的な説明", "impact": "高/中/低", "effort": "高/中/低" }
    ],
    "contentStrategy": [
      { "title": "戦略タイトル", "description": "具体的な説明" }
    ],
    "visualImprovement": [
      { "title": "改善タイトル", "description": "具体的な説明" }
    ],
    "engagementBoost": [
      { "title": "施策タイトル", "description": "具体的な説明" }
    ],
    "followerAcquisition": [
      { "title": "施策タイトル", "description": "具体的な説明" }
    ],
    "threeMonthRoadmap": {
      "month1": { "focus": "重点テーマ", "kpi": "KPI目標", "actions": ["アクション1", "アクション2"] },
      "month2": { "focus": "重点テーマ", "kpi": "KPI目標", "actions": ["アクション1", "アクション2"] },
      "month3": { "focus": "重点テーマ", "kpi": "KPI目標", "actions": ["アクション1", "アクション2"] }
    }
  }
}
```

---

## 注意事項

- **画像は必ず全件読み込んで分析してください**。画像を見ずにキャプションだけで判断しないでください。
- ベスト投稿・ワースト投稿の `index` は profile.json の posts 配列の index 値（0始まり）をそのまま使用してください。
- `likes` や `comments` が null の投稿はエンゲージメント計算から除外してください。
- colorPalette のHEXコードは、実際の画像群から抽出した代表的な色を指定してください。
- 改善提案は **具体的かつ実行可能** な内容にしてください。「もっと頑張りましょう」のような抽象的な提案は不可です。
- JSON以外の出力（説明文、マークダウン、コードブロックの囲み記号）は一切不要です。純粋なJSONのみを出力してください。
