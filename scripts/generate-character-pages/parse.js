const cheerio = require('cheerio');

function parseCharacterPage(html) {
  const $ = cheerio.load(html);

  const name = $('h1').first().text().trim();
  const locationLine = $('h1').first().next('p').text().trim();
  // "〒1000001｜東京都 千代田区 千代田"
  const locationMatch = locationLine.match(/〒(\d{7})｜(.+)/);
  const postalCode = locationMatch ? locationMatch[1] : '';
  const area = locationMatch ? locationMatch[2] : '';

  // Get story text (all paragraphs after ストーリー h2)
  let story = '';
  $('div.section').each((i, el) => {
    const heading = $(el).find('h2').text().trim();
    if (heading === 'ストーリー') {
      story = $(el).find('p').map((j, p) => $(p).text().trim()).get().filter(t => t).join('\n');
    }
  });

  // Get intro text
  let intro = '';
  $('div.section').each((i, el) => {
    const heading = $(el).find('h2').text().trim();
    if (heading === '紹介') {
      intro = $(el).find('p').map((j, p) => $(p).text().trim()).get().filter(t => t).join('\n');
    }
  });

  return { name, postalCode, area, intro, story };
}

module.exports = { parseCharacterPage };
