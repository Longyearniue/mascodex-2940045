export async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const response = await fetch(robotsUrl, {
      headers: {
        'User-Agent': 'GoenchanBot/1.0 (Founder Visibility Checker)',
      },
    });

    if (!response.ok) {
      // No robots.txt means we can crawl
      return true;
    }

    const robotsTxt = await response.text();

    // Simple check: if User-agent: * has Disallow: /, block everything
    const lines = robotsTxt.split('\n');
    let blockAll = false;
    let isUniversalAgent = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      if (trimmed.startsWith('user-agent:')) {
        isUniversalAgent = trimmed.includes('*');
      }

      if (isUniversalAgent && trimmed === 'disallow: /') {
        blockAll = true;
        break;
      }
    }

    return !blockAll;
  } catch (e) {
    // If robots.txt fetch fails, allow crawling
    return true;
  }
}
