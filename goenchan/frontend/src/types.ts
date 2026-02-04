export interface FounderVisibilityResponse {
  url: string;
  founder_visibility: boolean;
  evidence: string[];
  checked_urls: string[];
  hit_keywords: string[];
}

export interface OutreachGenerateResponse {
  eligible: boolean;
  subject?: string;
  body?: string;
  evidence?: string[];
  reason?: string;
}

export interface SalesLetterResponse {
  subject: string;
  body: string;
  promptUsed?: string;
}
