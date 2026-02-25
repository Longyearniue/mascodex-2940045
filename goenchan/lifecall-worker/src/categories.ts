// src/categories.ts

export interface CategoryField {
  key: string;
  label_ja: string;
  label_en: string;
  required: boolean;
  type: 'text' | 'date' | 'number' | 'select';
  options?: { value: string; label_ja: string; label_en: string }[];
}

export interface Category {
  id: string;
  name_ja: string;
  name_en: string;
  tier: 500 | 1500 | 3000;
  max_calls: number;
  fields: CategoryField[];
  call_purpose_ja: string;
  call_purpose_en: string;
  needs_search: boolean; // true = use Google Places to find target
}

export const CATEGORIES: Record<string, Category> = {
  // === Tier 1: 500 yen ===
  hospital_new: {
    id: 'hospital_new',
    name_ja: '病院初診予約',
    name_en: 'New patient hospital appointment',
    tier: 500,
    max_calls: 1,
    needs_search: true,
    call_purpose_ja: '初診の予約',
    call_purpose_en: 'Book a first-visit appointment',
    fields: [
      { key: 'hospital_name', label_ja: '病院名', label_en: 'Hospital name', required: false, type: 'text' },
      { key: 'department', label_ja: '科目', label_en: 'Department', required: true, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
      { key: 'symptoms', label_ja: '症状（任意）', label_en: 'Symptoms (optional)', required: false, type: 'text' },
    ],
  },
  hospital_change: {
    id: 'hospital_change',
    name_ja: '再診予約変更',
    name_en: 'Reschedule follow-up appointment',
    tier: 500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '再診予約の変更',
    call_purpose_en: 'Reschedule an existing appointment',
    fields: [
      { key: 'hospital_name', label_ja: '病院名', label_en: 'Hospital name', required: true, type: 'text' },
      { key: 'patient_name', label_ja: '患者名', label_en: 'Patient name', required: true, type: 'text' },
      { key: 'current_date', label_ja: '現在の予約日', label_en: 'Current appointment date', required: true, type: 'date' },
      { key: 'new_date', label_ja: '希望変更日', label_en: 'New preferred date', required: true, type: 'date' },
    ],
  },
  dentist: {
    id: 'dentist',
    name_ja: '歯医者予約',
    name_en: 'Dentist appointment',
    tier: 500,
    max_calls: 1,
    needs_search: true,
    call_purpose_ja: '歯科の予約',
    call_purpose_en: 'Book a dental appointment',
    fields: [
      { key: 'dentist_name', label_ja: '歯科名', label_en: 'Dentist name', required: false, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
      { key: 'symptoms', label_ja: '症状（任意）', label_en: 'Symptoms (optional)', required: false, type: 'text' },
    ],
  },
  health_check: {
    id: 'health_check',
    name_ja: '健康診断予約',
    name_en: 'Health check-up appointment',
    tier: 500,
    max_calls: 1,
    needs_search: true,
    call_purpose_ja: '健康診断の予約',
    call_purpose_en: 'Book a health check-up',
    fields: [
      { key: 'facility_name', label_ja: '施設名', label_en: 'Facility name', required: false, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
      { key: 'check_type', label_ja: '検査種類', label_en: 'Check-up type', required: true, type: 'text' },
    ],
  },
  restaurant: {
    id: 'restaurant',
    name_ja: 'レストラン予約',
    name_en: 'Restaurant reservation',
    tier: 500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: 'レストランの予約',
    call_purpose_en: 'Make a restaurant reservation',
    fields: [
      { key: 'restaurant_name', label_ja: '店名', label_en: 'Restaurant name', required: true, type: 'text' },
      { key: 'date_time', label_ja: '日時', label_en: 'Date and time', required: true, type: 'text' },
      { key: 'party_size', label_ja: '人数', label_en: 'Party size', required: true, type: 'number' },
      { key: 'requests', label_ja: '要望（個室等）', label_en: 'Requests (private room, etc.)', required: false, type: 'text' },
    ],
  },
  karaoke: {
    id: 'karaoke',
    name_ja: 'カラオケ予約',
    name_en: 'Karaoke reservation',
    tier: 500,
    max_calls: 1,
    needs_search: true,
    call_purpose_ja: 'カラオケの予約',
    call_purpose_en: 'Book a karaoke room',
    fields: [
      { key: 'karaoke_name', label_ja: '店名', label_en: 'Karaoke name', required: false, type: 'text' },
      { key: 'date_time', label_ja: '日時', label_en: 'Date and time', required: true, type: 'text' },
      { key: 'party_size', label_ja: '人数', label_en: 'Party size', required: true, type: 'number' },
    ],
  },
  izakaya_group: {
    id: 'izakaya_group',
    name_ja: '居酒屋団体予約',
    name_en: 'Group izakaya reservation',
    tier: 500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '居酒屋の団体予約',
    call_purpose_en: 'Book a group reservation at izakaya',
    fields: [
      { key: 'izakaya_name', label_ja: '店名', label_en: 'Izakaya name', required: true, type: 'text' },
      { key: 'date_time', label_ja: '日時', label_en: 'Date and time', required: true, type: 'text' },
      { key: 'party_size', label_ja: '人数', label_en: 'Party size', required: true, type: 'number' },
      { key: 'course', label_ja: 'コース有無', label_en: 'Course meal?', required: false, type: 'text' },
      { key: 'budget', label_ja: '予算', label_en: 'Budget per person', required: false, type: 'text' },
    ],
  },
  birthday: {
    id: 'birthday',
    name_ja: '誕生日サプライズ確認',
    name_en: 'Birthday surprise confirmation',
    tier: 500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '誕生日サプライズの確認',
    call_purpose_en: 'Confirm birthday surprise arrangements',
    fields: [
      { key: 'restaurant_name', label_ja: '店名', label_en: 'Restaurant name', required: true, type: 'text' },
      { key: 'date_time', label_ja: '日時', label_en: 'Date and time', required: true, type: 'text' },
      { key: 'surprise_details', label_ja: 'サプライズ内容', label_en: 'Surprise details', required: true, type: 'text' },
    ],
  },

  // === Tier 2: 1500 yen ===
  moving: {
    id: 'moving',
    name_ja: '引越し業者比較',
    name_en: 'Moving company comparison',
    tier: 1500,
    max_calls: 3,
    needs_search: true,
    call_purpose_ja: '引越し見積もりの依頼',
    call_purpose_en: 'Request moving quotes',
    fields: [
      { key: 'current_address', label_ja: '現住所', label_en: 'Current address', required: true, type: 'text' },
      { key: 'new_address', label_ja: '引越先', label_en: 'New address', required: true, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
      { key: 'volume', label_ja: '荷物量', label_en: 'Volume (1-room, family, etc.)', required: true, type: 'text' },
    ],
  },
  internet: {
    id: 'internet',
    name_ja: 'インターネット契約確認',
    name_en: 'Internet contract inquiry',
    tier: 1500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: 'インターネット契約の確認・変更',
    call_purpose_en: 'Check or change internet contract',
    fields: [
      { key: 'provider_name', label_ja: 'プロバイダ名', label_en: 'Provider name', required: true, type: 'text' },
      { key: 'contract_number', label_ja: '契約番号（任意）', label_en: 'Contract number (optional)', required: false, type: 'text' },
      { key: 'question', label_ja: '質問内容', label_en: 'What you want to ask', required: true, type: 'text' },
    ],
  },
  utility_start: {
    id: 'utility_start',
    name_ja: '電気・ガス開栓予約',
    name_en: 'Utility start-up booking',
    tier: 1500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '電気/ガスの開栓予約',
    call_purpose_en: 'Book utility start-up',
    fields: [
      { key: 'utility_company', label_ja: '電力/ガス会社', label_en: 'Utility company', required: true, type: 'text' },
      { key: 'address', label_ja: '住所', label_en: 'Address', required: true, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
    ],
  },
  move_out: {
    id: 'move_out',
    name_ja: '退去連絡',
    name_en: 'Move-out notification',
    tier: 1500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '退去の連絡',
    call_purpose_en: 'Notify move-out',
    fields: [
      { key: 'management_company', label_ja: '管理会社名', label_en: 'Management company', required: true, type: 'text' },
      { key: 'property_name', label_ja: '物件名', label_en: 'Property name', required: true, type: 'text' },
      { key: 'move_out_date', label_ja: '退去希望日', label_en: 'Move-out date', required: true, type: 'date' },
    ],
  },
  aircon_repair: {
    id: 'aircon_repair',
    name_ja: 'エアコン修理',
    name_en: 'Air conditioner repair',
    tier: 1500,
    max_calls: 2,
    needs_search: true,
    call_purpose_ja: 'エアコン修理の見積・予約',
    call_purpose_en: 'Get AC repair estimate and book',
    fields: [
      { key: 'vendor_name', label_ja: 'メーカーor業者名', label_en: 'Brand or repair company', required: false, type: 'text' },
      { key: 'symptoms', label_ja: '症状', label_en: 'Symptoms', required: true, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
    ],
  },
  junk_removal: {
    id: 'junk_removal',
    name_ja: '不用品回収見積',
    name_en: 'Junk removal estimate',
    tier: 1500,
    max_calls: 2,
    needs_search: true,
    call_purpose_ja: '不用品回収の見積もり',
    call_purpose_en: 'Get junk removal estimates',
    fields: [
      { key: 'items', label_ja: '品目リスト', label_en: 'List of items', required: true, type: 'text' },
      { key: 'preferred_date', label_ja: '希望日', label_en: 'Preferred date', required: true, type: 'date' },
    ],
  },
  return_exchange: {
    id: 'return_exchange',
    name_ja: '返品・交換連絡',
    name_en: 'Return/exchange request',
    tier: 1500,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '返品・交換の連絡',
    call_purpose_en: 'Request return or exchange',
    fields: [
      { key: 'store_name', label_ja: '店名', label_en: 'Store name', required: true, type: 'text' },
      { key: 'product_name', label_ja: '商品名', label_en: 'Product name', required: true, type: 'text' },
      { key: 'purchase_date', label_ja: '購入日', label_en: 'Purchase date', required: true, type: 'date' },
      { key: 'reason', label_ja: '理由', label_en: 'Reason', required: true, type: 'text' },
    ],
  },

  // === Tier 3: 3000 yen ===
  plumbing: {
    id: 'plumbing',
    name_ja: 'トイレ水漏れ',
    name_en: 'Plumbing emergency',
    tier: 3000,
    max_calls: 3,
    needs_search: true,
    call_purpose_ja: '水漏れ修理業者への連絡',
    call_purpose_en: 'Contact plumber for leak repair',
    fields: [
      { key: 'water_stopped', label_ja: '水は止まっていますか？', label_en: 'Is the water stopped?', required: true, type: 'select', options: [
        { value: 'yes', label_ja: 'はい', label_en: 'Yes' },
        { value: 'no', label_ja: 'いいえ', label_en: 'No' },
      ]},
      { key: 'address', label_ja: '住所', label_en: 'Address', required: true, type: 'text' },
      { key: 'preferred_time', label_ja: '希望対応時間', label_en: 'Preferred time', required: true, type: 'text' },
      { key: 'budget_max', label_ja: '予算上限', label_en: 'Budget limit', required: false, type: 'text' },
    ],
  },
  locksmith: {
    id: 'locksmith',
    name_ja: '鍵紛失',
    name_en: 'Lost key / locksmith',
    tier: 3000,
    max_calls: 3,
    needs_search: true,
    call_purpose_ja: '鍵業者への連絡',
    call_purpose_en: 'Contact locksmith',
    fields: [
      { key: 'address', label_ja: '住所', label_en: 'Address', required: true, type: 'text' },
      { key: 'lock_type', label_ja: '鍵の種類', label_en: 'Lock type', required: true, type: 'text' },
      { key: 'situation', label_ja: '現在の状況', label_en: 'Current situation', required: true, type: 'text' },
    ],
  },
  gym_cancel: {
    id: 'gym_cancel',
    name_ja: 'ジム解約',
    name_en: 'Gym cancellation',
    tier: 3000,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: 'ジムの解約手続き',
    call_purpose_en: 'Cancel gym membership',
    fields: [
      { key: 'gym_name', label_ja: 'ジム名', label_en: 'Gym name', required: true, type: 'text' },
      { key: 'member_id', label_ja: '会員番号', label_en: 'Member ID', required: false, type: 'text' },
      { key: 'member_name', label_ja: '会員名', label_en: 'Member name', required: true, type: 'text' },
    ],
  },
  subscription_cancel: {
    id: 'subscription_cancel',
    name_ja: 'サブスク解約',
    name_en: 'Subscription cancellation',
    tier: 3000,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: 'サブスクリプションの解約',
    call_purpose_en: 'Cancel subscription',
    fields: [
      { key: 'service_name', label_ja: 'サービス名', label_en: 'Service name', required: true, type: 'text' },
      { key: 'member_info', label_ja: '会員情報', label_en: 'Member info', required: true, type: 'text' },
    ],
  },
  newspaper_cancel: {
    id: 'newspaper_cancel',
    name_ja: '新聞解約',
    name_en: 'Newspaper cancellation',
    tier: 3000,
    max_calls: 1,
    needs_search: false,
    call_purpose_ja: '新聞の解約',
    call_purpose_en: 'Cancel newspaper subscription',
    fields: [
      { key: 'newspaper_name', label_ja: '新聞社名', label_en: 'Newspaper name', required: true, type: 'text' },
      { key: 'customer_number', label_ja: '顧客番号（任意）', label_en: 'Customer number (optional)', required: false, type: 'text' },
      { key: 'address', label_ja: '住所', label_en: 'Address', required: true, type: 'text' },
    ],
  },
};

export const TIER_PRICES = {
  500: { ja: 500, en: 750 },
  1500: { ja: 1500, en: 2250 },
  3000: { ja: 3000, en: 4500 },
} as const;

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES[id];
}

export function detectCategory(message: string): string | null {
  const keywords: Record<string, string[]> = {
    hospital_new: ['病院', '初診', 'hospital', 'doctor', '内科', '外科', '皮膚科', '眼科', '耳鼻科'],
    hospital_change: ['再診', '予約変更', 'reschedule', '予約を変えたい'],
    dentist: ['歯医者', '歯科', 'dentist', '歯が痛い', '虫歯'],
    health_check: ['健康診断', '人間ドック', 'health check', '健診'],
    restaurant: ['レストラン', 'restaurant', '食事', 'ディナー', 'ランチ'],
    karaoke: ['カラオケ', 'karaoke'],
    izakaya_group: ['居酒屋', '飲み会', '宴会', 'izakaya', '団体'],
    birthday: ['誕生日', 'バースデー', 'birthday', 'サプライズ'],
    moving: ['引越し', '引っ越し', 'moving', '引越'],
    internet: ['インターネット', 'ネット回線', 'WiFi', 'プロバイダ', 'internet'],
    utility_start: ['電気', 'ガス', '開栓', 'utility', '電力'],
    move_out: ['退去', '引き払い', 'move out', '退居'],
    aircon_repair: ['エアコン', '冷房', '暖房', 'air conditioner', 'AC修理'],
    junk_removal: ['不用品', '粗大ごみ', 'junk', '回収'],
    return_exchange: ['返品', '交換', 'return', 'exchange', '返却'],
    plumbing: ['水漏れ', '水道', 'トイレ', 'plumbing', '水が止まらない', '配管'],
    locksmith: ['鍵', 'ロック', 'locksmith', '鍵紛失', '閉め出し'],
    gym_cancel: ['ジム', 'gym', 'フィットネス', 'スポーツクラブ'],
    subscription_cancel: ['サブスク', 'subscription', '解約したい', '月額'],
    newspaper_cancel: ['新聞', 'newspaper', '朝刊', '読売', '朝日', '毎日'],
  };

  const lower = message.toLowerCase();
  for (const [catId, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (lower.includes(word.toLowerCase())) return catId;
    }
  }
  return null;
}
