import type { FounderVisibilityResponse, OutreachGenerateResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

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
