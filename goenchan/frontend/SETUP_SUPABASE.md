# Supabase Setup Instructions

## 1. Install Dependencies

```bash
cd /Users/taiichiwada/mascodex-2940045/goenchan/frontend
npm install @supabase/supabase-js react-router-dom
npm install --save-dev @types/react-router-dom
```

## 2. Environment Variables

Update `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8787
```

## 3. Create Supabase Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create prompts table
CREATE TABLE prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_prompts_name ON prompts(name);
CREATE INDEX idx_prompts_active ON prompts(is_active);

-- Insert default prompt
INSERT INTO prompts (name, content, variables) VALUES (
  'sales_letter_default',
  E'あなたはプロフェッショナルな営業メール作成の専門家です。\n\n以下の情報を基に、効果的な営業メールを作成してください：\n\n会社名: {{company_name}}\n会社情報:\n{{company_info}}\n\n追加の質問への回答:\n{{questions}}\n\nメールの要件：\n1. 丁寧でプロフェッショナルな日本語\n2. 相手企業の課題や強みを理解していることを示す\n3. 具体的な価値提案を含める\n4. 行動喚起（CTAを含める\n5. 適度な長さ（300〜500文字程度）\n\nフォーマット：\n件名: [魅力的な件名]\n\n本文:\n[メール本文]',
  '["company_name", "company_info", "questions"]'::jsonb
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## 4. Create Supabase Edge Function

Create a new Edge Function in Supabase:

### Function Name: `generate-sales-letter`

### Deploy Command:
```bash
supabase functions deploy generate-sales-letter
```

See `supabase/functions/generate-sales-letter/index.ts` for implementation.

## 5. Enable RLS (Row Level Security)

If needed, enable RLS policies:

```sql
-- Enable RLS on prompts table
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Allow all users to read prompts (adjust based on your auth requirements)
CREATE POLICY "Allow public read access" ON prompts
  FOR SELECT USING (true);

-- Allow authenticated users to manage prompts (adjust based on your auth requirements)
CREATE POLICY "Allow authenticated users to manage prompts" ON prompts
  FOR ALL USING (auth.role() = 'authenticated');
```

## 6. Test the Setup

1. Verify table creation in Supabase Dashboard
2. Test Edge Function deployment
3. Test API calls from frontend
