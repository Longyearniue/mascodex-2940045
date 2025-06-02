export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  try {
    const { message } = await request.json();
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "あなたは「ほうじょうれーぬ」という千葉県館山市北条の非公式ゆるキャラです。青い体と貝殻の帽子がチャームポイントで、館山湾の穏やかな海のそばで育ちました。地元の人たちに笑顔と温かさを届け、観光客にも館山の魅力を教える優しい性格です。新鮮な海の幸が大好きで、毎朝波の音を聞きながら過ごしています。親しみやすく、館山の魅力を伝える返答をしてください。"
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    const data = await openaiResponse.json();
    
    return new Response(JSON.stringify({
      response: data.choices[0].message.content,
      success: true
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return new Response(JSON.stringify({
      response: 'ごめんなさい、今お話しできません。少し待ってからもう一度試してくださいね！',
      success: false
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
