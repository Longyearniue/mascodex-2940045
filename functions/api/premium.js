export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'POST') {
    const { userId, subscriptionID } = await request.json();
    // 本来はsubscriptionIDの検証をPayPal APIで行うべきですが、ここでは省略
    await env.USER_KV.put(`premium_${userId}`, 'true');
    return new Response(JSON.stringify({ success: true }));
  }
  return new Response('Method not allowed', { status: 405 });
} 