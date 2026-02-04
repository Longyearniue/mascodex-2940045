export interface HistoricalFigure {
  name: string;
  period: string;
  reason: string;
  narrative: string;
}

// 歴史上の人物データベース（許可リストから）
interface FigureData {
  name: string;
  period: string;
  themes: string[]; // この人物が持つテーマ
  businessTypes?: string[]; // 適した業種
  getReasonTemplate: (companyFeature?: string) => string;
  narrative: string;
}

const FIGURE_DATABASE: FigureData[] = [
  // 医療・健康系
  {
    name: '北里柴三郎',
    period: '明治〜昭和時代の医学者・細菌学者',
    themes: ['医療', '健康', '科学', '社会貢献'],
    businessTypes: ['マッサージ・整体', '医療機関', '美容業'],
    getReasonTemplate: (feature) => feature
      ? `近代医学の発展に尽力し、予防医学の重要性を説いた医学者。${feature}という御社の姿勢は、人々の健康を守ることに生涯を捧げた北里の精神と重なります`
      : '近代医学の発展に尽力し、予防医学の重要性を説いた医学者。人々の健康を守ることに生涯を捧げた姿勢が御社と重なります',
    narrative: '健康とは、病になってから治すものではない。日々の予防とケアにより、心身を整える。それこそが真の医療である'
  },
  {
    name: 'ナイチンゲール',
    period: '19世紀イギリスの看護師・社会改革家',
    themes: ['医療', '健康', 'ケア', 'おもてなし', '献身'],
    businessTypes: ['マッサージ・整体', '医療機関', '宿泊施設'],
    getReasonTemplate: (feature) => feature
      ? `近代看護の創始者として、患者一人ひとりに寄り添うケアの重要性を示した先駆者。${feature}という御社の姿勢は、献身的なケアを実践したナイチンゲールの精神と通じます`
      : '近代看護の創始者として、患者一人ひとりに寄り添うケアの重要性を示した先駆者。献身的な姿勢が御社と共通します',
    narrative: 'ケアとは、ただ処置を施すことではない。一人ひとりの体と心に向き合い、その人本来の力を引き出す。それが真の癒やしである'
  },
  {
    name: 'ヘレン・ケラー',
    period: '19〜20世紀アメリカの社会福祉活動家',
    themes: ['福祉', '教育', '希望', '困難克服'],
    businessTypes: ['医療機関', '教育機関'],
    getReasonTemplate: (feature) => feature
      ? `視聴覚障害を乗り越え、多くの人々に希望を与えた活動家。${feature}という御社の姿勢は、困難な状況にある人々を支援したケラーの精神と共鳴します`
      : '視聴覚障害を乗り越え、多くの人々に希望を与えた活動家。困難な状況にある人々を支援する姿勢に共感します',
    narrative: '支援とは、ただ手を差し伸べることではない。その人の可能性を信じ、自立を支える。それが真の医療・福祉である'
  },

  // 芸術・美容系
  {
    name: '紫式部',
    period: '平安時代の女性作家',
    themes: ['美', '文化', '個性', '繊細'],
    businessTypes: ['美容業'],
    getReasonTemplate: (feature) => feature
      ? `「源氏物語」を著し、繊細な美意識と人間理解を示した作家。${feature}という御社の姿勢は、一人ひとりの個性を大切にした紫式部の精神と重なります`
      : '「源氏物語」を著し、繊細な美意識と人間理解を示した作家。一人ひとりの個性を大切にする姿勢が御社と重なります',
    narrative: '美しさとは、画一的なものではない。その人らしさを大切にし、個性を引き出す。そこに真の価値がある'
  },
  {
    name: 'ダ・ヴィンチ',
    period: 'ルネサンス期イタリアの芸術家・科学者',
    themes: ['芸術', '技術', '革新', '美', '創造'],
    businessTypes: ['美容業', '製造業', 'IT企業'],
    getReasonTemplate: (feature) => feature
      ? `芸術と科学を融合させ、美の本質を追求した万能の天才。${feature}という御社の姿勢は、技術と美意識を両立させたダ・ヴィンチの精神と通じます`
      : '芸術と科学を融合させ、美の本質を追求した万能の天才。技術と美意識の両立が御社と通じます',
    narrative: '美とは、表面的な装飾ではない。その人の内面と外面が調和したとき、初めて真の美しさが生まれる'
  },
  {
    name: 'ミケランジェロ',
    period: 'ルネサンス期イタリアの彫刻家・画家',
    themes: ['芸術', '美', '職人', 'こだわり'],
    businessTypes: ['美容業', '製造業'],
    getReasonTemplate: (feature) => feature
      ? `大理石の中に美を見出し、一つ一つの作品に魂を込めた芸術家。${feature}という御社の姿勢は、細部へのこだわりを貫いたミケランジェロの精神と共鳴します`
      : '大理石の中に美を見出し、一つ一つの作品に魂を込めた芸術家。細部へのこだわりと美への情熱が共通します',
    narrative: '美を創り出すとは、外から付け加えることではない。すでにそこにある美しさを引き出し、磨き上げることである'
  },
  {
    name: '葛飾北斎',
    period: '江戸時代の浮世絵師',
    themes: ['芸術', '地域', '文化', '伝統'],
    businessTypes: ['宿泊施設', '飲食店'],
    getReasonTemplate: (feature) => feature
      ? `日本の風景や文化を世界に伝えた芸術家。${feature}という御社の姿勢は、地域の魅力を発信し多くの人々を魅了した北斎の精神と通じます`
      : '日本の風景や文化を世界に伝えた芸術家。地域の魅力を発信し、多くの人々を魅了した姿勢に共感します',
    narrative: 'この地の美しさを伝えることは、ただ景色を見せることではない。その土地の歴史、文化、人々の想いを伝える。それが真の魅力である'
  },
  {
    name: '歌川広重',
    period: '江戸時代の浮世絵師',
    themes: ['芸術', '地域', '旅', '文化'],
    businessTypes: ['宿泊施設'],
    getReasonTemplate: (feature) => feature
      ? `「東海道五十三次」で各地の風景を美しく描き、旅の魅力を伝えた浮世絵師。${feature}という御社の姿勢は、その土地の美しさを表現した広重の精神と重なります`
      : '「東海道五十三次」で各地の風景を美しく描き、旅の魅力を伝えた浮世絵師。その土地の美しさを表現する姿勢が御社と通じます',
    narrative: 'この土地の美しさ、文化、人々の営み。それらを丁寧に伝えることで、旅人に新たな気づきをもたらす'
  },

  // 経営・商売系
  {
    name: '渋沢栄一',
    period: '明治〜大正時代の実業家',
    themes: ['経営', '道徳', '社会貢献', '誠実'],
    businessTypes: ['飲食店', '製造業', 'IT企業'],
    getReasonTemplate: (feature) => feature
      ? `「日本資本主義の父」として、経済と道徳の両立を説いた実業家。${feature}という御社の姿勢は、社会貢献を重視した渋沢の精神と通じます`
      : '「日本資本主義の父」として、経済と道徳の両立を説いた実業家。社会貢献を重視する姿勢が御社と共通します',
    narrative: '事業とは、利益追求だけではない。道徳と経済を両立させ、社会全体を豊かにする。それが真の実業である'
  },
  {
    name: '徳川家康',
    period: '戦国〜江戸時代初期の武将・江戸幕府初代将軍',
    themes: ['経営', '長期視野', '信頼', '持続'],
    businessTypes: ['飲食店', '製造業'],
    getReasonTemplate: (feature) => feature
      ? `長期的視野で基盤を築き、持続可能な発展を実現した指導者。${feature}という御社の姿勢は、地道な努力で信頼を築いた家康の精神と重なります`
      : '長期的視野で基盤を築き、持続可能な発展を実現した指導者。お客様との長い信頼関係を大切にする姿勢が共通します',
    narrative: '事業とは、一時の成功ではない。地道な努力を重ね、信頼を積み上げる。それが長く続く繁栄の基盤となる'
  },

  // 思想・哲学系
  {
    name: '孔子',
    period: '春秋時代中国の思想家',
    themes: ['思いやり', '誠実', '人間関係', '道徳'],
    businessTypes: ['飲食店', '宿泊施設', '教育機関'],
    getReasonTemplate: (feature) => feature
      ? `「仁」の思想で人と人との関係性を重視した哲学者。${feature}という御社の姿勢は、思いやりと誠実さを説いた孔子の教えと通じます`
      : '「仁」の思想で人と人との関係性を重視した哲学者。お客様への思いやりと誠実さを説いた教えが御社と重なります',
    narrative: 'もてなしとは、形式ではない。相手を思いやり、心を込めて接する。その誠実さが、人と人とのつながりを生む'
  },
  {
    name: '道元',
    period: '鎌倉時代の禅僧・曹洞宗の開祖',
    themes: ['心身', '修行', '調和', '禅'],
    businessTypes: ['マッサージ・整体'],
    getReasonTemplate: (feature) => feature
      ? `坐禅を通じて心身を整える修行法を確立した禅僧。${feature}という御社の姿勢は、心と体の調和を目指した道元の精神と共鳴します`
      : '坐禅を通じて心身を整える修行法を確立。呼吸と姿勢を大切にし、心と体の調和を目指した姿勢に共感します',
    narrative: '心と体は一つである。呼吸を整え、姿勢を正し、心を落ち着ける。そこに真の健やかさが宿る'
  },
  {
    name: 'ソクラテス',
    period: '古代ギリシャの哲学者',
    themes: ['教育', '対話', '思考', '真理'],
    businessTypes: ['教育機関'],
    getReasonTemplate: (feature) => feature
      ? `問答法で弟子たちに自ら考えさせる教育を実践した哲学者。${feature}という御社の姿勢は、主体的な学びを促したソクラテスの精神と通じます`
      : '問答法で弟子たちに自ら考えさせる教育を実践した哲学者。主体的な学びを促す姿勢が御社の教育と通じます',
    narrative: '教育とは、答えを与えることではない。問いを投げかけ、自ら考える力を育てる。そこに真の学びがある'
  },
  {
    name: 'ガンジー',
    period: '19〜20世紀インドの政治指導者',
    themes: ['誠実', '非暴力', '信念', '社会変革'],
    getReasonTemplate: (feature) => feature
      ? `非暴力・不服従の理念で社会を変革した指導者。${feature}という御社の姿勢は、誠実さと一貫性で信頼を築いたガンジーの精神と重なります`
      : '非暴力・不服従の理念で社会を変革した指導者。地道な努力と誠実さで信頼を築く姿勢が共通します',
    narrative: '真の力とは、強制ではない。誠実さと一貫性をもって、人々の信頼を得る。それが持続可能な発展の基盤となる'
  },

  // 科学・技術系
  {
    name: 'エジソン',
    period: '19〜20世紀アメリカの発明家',
    themes: ['技術', '革新', '実用', '創造'],
    businessTypes: ['製造業', 'IT企業'],
    getReasonTemplate: (feature) => feature
      ? `1000以上の発明で人々の生活を豊かにした発明家。${feature}という御社の姿勢は、実用性を追求したエジソンの精神と通じます`
      : '1000以上の発明で人々の生活を豊かにした発明家。技術革新と実用性の追求が御社のものづくりと重なります',
    narrative: 'ものづくりとは、理想を追うだけではない。実際に人々の役に立ち、生活を豊かにする製品を生み出す。それが真の技術である'
  },
  {
    name: 'アインシュタイン',
    period: '20世紀の理論物理学者',
    themes: ['科学', '革新', '論理', '創造'],
    businessTypes: ['IT企業'],
    getReasonTemplate: (feature) => feature
      ? `相対性理論で世界の見方を変えた科学者。${feature}という御社の姿勢は、革新的な発想と論理的思考を両立させたアインシュタインの精神と通じます`
      : '相対性理論で世界の見方を変えた科学者。革新的な発想と論理的思考が、御社のIT事業と重なります',
    narrative: '技術とは、それ自体が目的ではない。人々の暮らしを豊かにし、社会の課題を解決するための手段である'
  },
  {
    name: 'テスラ',
    period: '19〜20世紀の発明家・電気技師',
    themes: ['技術', '革新', '未来志向'],
    businessTypes: ['製造業', 'IT企業'],
    getReasonTemplate: (feature) => feature
      ? `交流電流システムを発明し、現代社会の基盤を築いた技術者。${feature}という御社の姿勢は、先進的な技術で社会に貢献したテスラの精神と共鳴します`
      : '交流電流システムを発明し、現代社会の基盤を築いた技術者。先進的な技術で社会に貢献した姿勢に共感します',
    narrative: '技術とは、自己満足ではない。社会の課題を解決し、未来の世代に豊かさを残す。それが技術者の使命である'
  },
  {
    name: 'ニュートン',
    period: '17〜18世紀イギリスの物理学者・数学者',
    themes: ['科学', '論理', '体系', '基礎'],
    businessTypes: ['IT企業', '製造業'],
    getReasonTemplate: (feature) => feature
      ? `万有引力の法則を発見し、科学の基礎を築いた科学者。${feature}という御社の姿勢は、論理的思考と体系的アプローチを重視したニュートンの精神と通じます`
      : '万有引力の法則を発見し、科学の基礎を築いた科学者。論理的思考と体系的アプローチが御社の技術開発と通じます',
    narrative: '複雑な問題も、本質を見極め、論理的に解決する。そこに技術の力がある'
  },

  // 教育系
  {
    name: '福沢諭吉',
    period: '明治時代の教育者・思想家',
    themes: ['教育', '啓蒙', '社会変革', '自立'],
    businessTypes: ['教育機関'],
    getReasonTemplate: (feature) => feature
      ? `慶應義塾を創設し、「学問のすすめ」で教育の重要性を説いた啓蒙家。${feature}という御社の姿勢は、教育で社会を変革しようとした福沢の精神と重なります`
      : '慶應義塾を創設し、「学問のすすめ」で教育の重要性を説いた啓蒙家。教育で社会を変革する姿勢が御社と重なります',
    narrative: '教育とは、知識を授けるだけではない。自ら考え、判断し、社会に貢献できる人間を育てる。それが教育の目的である'
  },
  {
    name: '吉田松陰',
    period: '江戸時代末期の思想家・教育者',
    themes: ['教育', '志', '人材育成', '情熱'],
    businessTypes: ['教育機関'],
    getReasonTemplate: (feature) => feature
      ? `松下村塾で多くの志士を育て、明治維新の原動力となった教育者。${feature}という御社の姿勢は、一人ひとりの可能性を信じた松陰の精神と通じます`
      : '松下村塾で多くの志士を育て、明治維新の原動力となった教育者。一人ひとりの可能性を引き出す教育が共通します',
    narrative: '教育とは、型にはめることではない。一人ひとりの志を見出し、その可能性を信じて育てる。それが真の教育である'
  },

  // リーダーシップ系
  {
    name: 'リンカーン',
    period: '19世紀アメリカ合衆国第16代大統領',
    themes: ['誠実', '信念', 'リーダーシップ', '困難克服'],
    getReasonTemplate: (feature) => feature
      ? `誠実さと信念を貫き、困難な時代に国をまとめたリーダー。${feature}という御社の姿勢は、どんな困難にも誠実さを貫いたリンカーンの精神と共鳴します`
      : '誠実さと信念を貫き、困難な時代に国をまとめたリーダー。誠実な経営姿勢が御社と重なります',
    narrative: '事業とは、困難があっても誠実さを貫くこと。お客様と社会への責任を果たし続ける。それが真のリーダーシップである'
  },
  {
    name: '坂本龍馬',
    period: '江戸時代末期の志士',
    themes: ['革新', '改革', '行動力', '志'],
    getReasonTemplate: (feature) => feature
      ? `幕末の混乱期に新しい日本の姿を描き、行動した志士。${feature}という御社の姿勢は、既存の枠にとらわれず行動した龍馬の精神と通じます`
      : '幕末の混乱期に新しい日本の姿を描き、行動した志士。革新的な発想と行動力が御社と通じます',
    narrative: '改革とは、理想を語るだけではない。自ら行動し、新しい道を切り拓く。それが真の志である'
  }
];

export function suggestHistoricalFigures(
  businessType: string,
  philosophy: string,
  uniqueStrengths: string[],
  location: string
): HistoricalFigure[] {
  // 企業の特徴を分析
  const companyThemes = analyzeCompanyThemes(philosophy, uniqueStrengths);
  const companyFeature = extractCompanyFeature(philosophy, uniqueStrengths);

  // 候補をスコアリング
  const scoredFigures = FIGURE_DATABASE.map(figure => {
    let score = 0;

    // 業種マッチング（高優先度）
    if (figure.businessTypes?.includes(businessType)) {
      score += 100;
    }

    // テーママッチング
    const matchingThemes = figure.themes.filter(theme => companyThemes.has(theme));
    score += matchingThemes.length * 30;

    // バラエティのためランダム要素を追加（小さめ）
    score += Math.random() * 10;

    return {
      figure,
      score,
      matchingThemes
    };
  });

  // スコア順にソート
  scoredFigures.sort((a, b) => b.score - a.score);

  // 上位から選択（ただし、同じ人物が重複しないように）
  const selectedFigures: HistoricalFigure[] = [];
  const usedNames = new Set<string>();

  for (const item of scoredFigures) {
    if (selectedFigures.length >= 3) break;
    if (usedNames.has(item.figure.name)) continue;

    // 選定理由を企業の特徴を踏まえて生成
    const reason = item.figure.getReasonTemplate(companyFeature);

    selectedFigures.push({
      name: item.figure.name,
      period: item.figure.period,
      reason,
      narrative: item.figure.narrative
    });

    usedNames.add(item.figure.name);
  }

  // 万が一3人未満の場合、デフォルトで渋沢栄一、リンカーン、ガンジーを追加
  if (selectedFigures.length < 3) {
    const defaultFigures = ['渋沢栄一', 'リンカーン', 'ガンジー'];

    for (const name of defaultFigures) {
      if (selectedFigures.length >= 3) break;
      if (usedNames.has(name)) continue;

      const figure = FIGURE_DATABASE.find(f => f.name === name);
      if (figure) {
        const reason = figure.getReasonTemplate(companyFeature);
        selectedFigures.push({
          name: figure.name,
          period: figure.period,
          reason,
          narrative: figure.narrative
        });
        usedNames.add(name);
      }
    }
  }

  return selectedFigures;
}

function analyzeCompanyThemes(philosophy: string, uniqueStrengths: string[]): Set<string> {
  const themes = new Set<string>();
  const combined = (philosophy + ' ' + uniqueStrengths.join(' ')).toLowerCase();

  const themePatterns = [
    { keywords: ['ものづくり', '製造', '職人', '手作り', '丁寧'], theme: '職人' },
    { keywords: ['技術', 'テクノロジー', 'システム', 'it', '開発'], theme: '技術' },
    { keywords: ['教育', '育成', '人材', '学習', '指導'], theme: '教育' },
    { keywords: ['医療', '健康', '看護', '介護', 'ケア'], theme: '医療' },
    { keywords: ['健康', '癒', '癒し', '養生', 'ウェルネス'], theme: '健康' },
    { keywords: ['もてなし', '接客', 'サービス', 'ホスピタリティ', 'お客様'], theme: 'おもてなし' },
    { keywords: ['美', '美容', 'エステ', 'ビューティー', '美しさ'], theme: '美' },
    { keywords: ['芸術', 'アート', 'デザイン', '表現'], theme: '芸術' },
    { keywords: ['地域', 'コミュニティ', '地元', 'ローカル', '地方'], theme: '地域' },
    { keywords: ['環境', 'エコ', '持続可能', 'サステナブル', '自然'], theme: '環境' },
    { keywords: ['革新', 'イノベーション', '新しい', '先進', '最新'], theme: '革新' },
    { keywords: ['伝統', '歴史', '継承', '文化', '古来'], theme: '伝統' },
    { keywords: ['誠実', '真摯', '正直', '信頼', '丁寧'], theme: '誠実' },
    { keywords: ['思いやり', '心', '想い', '気持ち', '寄り添'], theme: '思いやり' },
    { keywords: ['個性', '一人ひとり', 'オーダーメイド', 'カスタム'], theme: '個性' },
    { keywords: ['社会', '貢献', '地域貢献', 'csr', 'sdgs'], theme: '社会貢献' },
    { keywords: ['長期', '持続', '継続', '信頼関係', '積み重ね'], theme: '持続' },
    { keywords: ['科学', '論理', '分析', 'データ', '研究'], theme: '科学' },
    { keywords: ['対話', 'コミュニケーション', '会話', '交流'], theme: '対話' },
    { keywords: ['調和', 'バランス', '統合', '融合'], theme: '調和' }
  ];

  for (const pattern of themePatterns) {
    if (pattern.keywords.some(kw => combined.includes(kw))) {
      themes.add(pattern.theme);
    }
  }

  return themes;
}

function extractCompanyFeature(philosophy: string, uniqueStrengths: string[]): string {
  // 理念から抽出
  if (philosophy && philosophy.length > 20 && philosophy.length < 100) {
    const cleaned = philosophy
      .replace(/^[・\s]+/, '')
      .replace(/[。．]$/, '')
      .trim();

    const isGood =
      cleaned.length > 15 &&
      !cleaned.match(/(キャンペーン|お知らせ|News|CP|予約|円|font-family|color:|margin:|olapa|piko|マシン)/) &&
      !cleaned.includes('。');

    if (isGood) {
      return cleaned;
    }
  }

  // 強みから抽出
  if (uniqueStrengths.length > 0) {
    const strength = uniqueStrengths[0].replace(/[。．]$/, '').trim();
    if (strength.length > 15 && strength.length < 100) {
      return strength;
    }
  }

  return '';
}
