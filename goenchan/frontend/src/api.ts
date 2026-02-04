import type { FounderVisibilityResponse, OutreachGenerateResponse, SalesLetterResponse } from './types';
import { supabase } from './supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function checkFounderVisibility(url: string): Promise<FounderVisibilityResponse> {
  const response = await fetch(`${API_BASE_URL}/api/founder-visibility`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function generateOutreach(
  companyName: string,
  url: string,
  questions: string
): Promise<OutreachGenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/outreach/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyName, url, questions }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function generateSalesLetter(
  companyName: string,
  companyInfo: string,
  questions: string,
  promptName?: string
): Promise<SalesLetterResponse> {
  // Call Supabase Edge Function
  const { data, error } = await supabase.functions.invoke('generate-sales-letter', {
    body: {
      companyName,
      companyInfo,
      questions,
      promptName,
    },
  });

  if (error) {
    throw new Error(`API error: ${error.message}`);
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to generate sales letter');
  }

  return {
    subject: data.subject,
    body: data.body,
    promptUsed: data.promptUsed,
  };
}
