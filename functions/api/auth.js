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

  if (request.method === 'POST') {
    try {
      const { email, password, action } = await request.json();

      if (action === 'register') {
        const hashedPassword = await hashPassword(password);
        const userId = generateUserId(email);
        
        const userData = {
          id: userId,
          email: email,
          password: hashedPassword,
          createdAt: new Date().toISOString(),
          lastLoginDate: new Date().toISOString().split('T')[0],
          consecutiveDays: 1,
          dailyChats: 0,
          totalChats: 0,
          level: 1,
          xp: 0
        };
        await env.USER_KV.put(`profile_${userId}`, JSON.stringify(userData));
        return new Response(JSON.stringify({
          success: true,
          user: {
            id: userId,
            email: email,
            level: 1,
            xp: 0,
            consecutiveDays: 1,
            dailyChats: 0
          },
          token: generateToken(userId)
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (action === 'login') {
        const isValid = await validatePassword(password, email);
        
        if (isValid) {
          const userId = generateUserId(email);
          const today = new Date().toISOString().split('T')[0];
          
          let userData = await env.USER_KV.get(`profile_${userId}`, { type: 'json' });
          if (!userData) {
            userData = {
              id: userId,
              email: email,
              lastLoginDate: today,
              consecutiveDays: 1,
              dailyChats: 0,
              level: 1,
              xp: 0
            };
            await env.USER_KV.put(`profile_${userId}`, JSON.stringify(userData));
          }

          return new Response(JSON.stringify({
            success: true,
            user: {
              id: userId,
              email: email,
              level: userData.level,
              xp: userData.xp,
              consecutiveDays: userData.consecutiveDays,
              dailyChats: userData.dailyChats
            },
            token: generateToken(userId)
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid email or password'
          }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid action'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      console.error('Auth API error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Internal server error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  return new Response('Method not allowed', { 
    status: 405,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  });
}

async function hashPassword(password) {
  return btoa(password + 'salt');
}

async function validatePassword(password, email) {
  return password.length >= 6 && email.includes('@');
}

function generateUserId(email) {
  return 'user_' + btoa(email);
}

function generateToken(userId) {
  return btoa(userId + ':' + Date.now());
}

function calculateConsecutiveDays(today) {
  return 1;
}
