export interface FetchResult {
  success: boolean;
  html?: string;
  error?: string;
  statusCode?: number;
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 8000
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GoenchanBot/1.0 (Founder Visibility Checker)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        statusCode: response.status,
      };
    }

    const html = await response.text();
    return { success: true, html, statusCode: response.status };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return { success: false, error: 'Timeout' };
    }

    return { success: false, error: error.message || 'Fetch failed' };
  }
}
