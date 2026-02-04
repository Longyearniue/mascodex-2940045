import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  companyName: string;
  companyInfo: string;
  questions: string;
  promptName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { companyName, companyInfo, questions, promptName = 'sales_letter_default' }: RequestBody = await req.json();

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch prompt from database
    const { data: prompt, error: promptError } = await supabaseClient
      .from('prompts')
      .select('*')
      .eq('name', promptName)
      .eq('is_active', true)
      .single();

    if (promptError || !prompt) {
      throw new Error(`Prompt not found: ${promptName}`);
    }

    // Replace variables in prompt
    let promptContent = prompt.content;
    promptContent = promptContent.replace(/\{\{company_name\}\}/g, companyName);
    promptContent = promptContent.replace(/\{\{company_info\}\}/g, companyInfo);
    promptContent = promptContent.replace(/\{\{questions\}\}/g, questions);

    // Call Lovable AI Gateway (Gemini)
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_AI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gemini-1.5-pro-latest',
        messages: [
          {
            role: 'user',
            content: promptContent,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices[0]?.message?.content || '';

    // Parse subject and body from generated text
    const subjectMatch = generatedText.match(/件名[:：]\s*(.+?)(\n|$)/);
    const subject = subjectMatch ? subjectMatch[1].trim() : '営業メールのご提案';

    // Extract body (everything after subject line)
    let body = generatedText;
    if (subjectMatch) {
      body = generatedText.substring(subjectMatch.index! + subjectMatch[0].length).trim();
    }
    // Remove "本文:" prefix if exists
    body = body.replace(/^本文[:：]\s*/i, '').trim();

    return new Response(
      JSON.stringify({
        success: true,
        subject,
        body,
        promptUsed: promptName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in generate-sales-letter:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
