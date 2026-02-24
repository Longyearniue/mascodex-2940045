export default {
  async scheduled(event, env) {
    const baseUrl = env.GAME_API_BASE;
    const secret = env.CRON_SECRET;
    const headers = {
      'X-Cron-Secret': secret,
      'Content-Type': 'application/json',
    };

    try {
      switch (event.cron) {
        case '0 21 * * *':
          // 6:00 JST = 21:00 UTC previous day - Generate daily amoeba
          console.log('Generating daily amoeba...');
          const genRes = await fetch(`${baseUrl}/api/game/cron/generate-amoeba`, {
            method: 'POST',
            headers,
          });
          console.log('Amoeba generation result:', await genRes.text());
          break;

        case '0 * * * *':
          // Every hour - Spread amoebas
          console.log('Running hourly amoeba spread...');
          const spreadRes = await fetch(`${baseUrl}/api/game/cron/spread`, {
            method: 'POST',
            headers,
          });
          console.log('Spread result:', await spreadRes.text());
          break;

        case '0 20 * * *':
          // 5:00 JST = 20:00 UTC previous day - Daily summary
          console.log('Running daily summary...');
          const summaryRes = await fetch(`${baseUrl}/api/game/cron/daily-summary`, {
            method: 'POST',
            headers,
          });
          console.log('Summary result:', await summaryRes.text());
          break;
      }
    } catch (err) {
      console.error(`Cron ${event.cron} failed:`, err);
    }
  },

  async fetch(request) {
    return new Response('Mascodex Game Cron Worker - use scheduled triggers', { status: 200 });
  },
};
