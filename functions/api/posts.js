// GET /api/posts?page=1&limit=50&country=JP&status=posted
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const country = url.searchParams.get('country') || '';
  const status = url.searchParams.get('status') || 'posted';
  const offset = (page - 1) * limit;

  let where = `pq.status = '${status}'`;
  if (country === 'JP') where += ` AND length(pq.zip) = 9 AND pq.zip LIKE 'JP%'`;
  else if (country === 'US') where += ` AND length(pq.zip) = 5 AND pq.zip NOT LIKE 'JP%'`;
  else if (country === 'IN') where += ` AND length(pq.zip) = 6`;
  else if (country === 'AU') where += ` AND length(pq.zip) = 4`;

  const sql = `
    SELECT pq.id, pq.zip, pq.content, pq.lang, pq.status, pq.created_at, pq.posted_at,
           m.city, m.state
    FROM post_queue pq
    LEFT JOIN mascots m ON m.zip = pq.zip
    WHERE ${where}
    ORDER BY pq.rowid DESC
    LIMIT ${limit} OFFSET ${offset}`;

  const countSql = `SELECT COUNT(*) as c FROM post_queue pq WHERE ${where}`;

  const [res, countRes] = await Promise.all([
    context.env.MASCOT_D1.prepare(sql).all(),
    context.env.MASCOT_D1.prepare(countSql).all(),
  ]);

  const total = countRes.results[0].c;

  return new Response(JSON.stringify({
    posts: res.results,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
