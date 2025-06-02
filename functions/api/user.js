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
      const { userId, action } = await request.json();
      
      if (action === 'incrementChat') {
        const today = new Date().toISOString().split('T')[0];
        const userKey = `user_${userId}_${today}`;
        
        // Get existing data from a simple in-memory store (simulated with global variable)
        if (!globalThis.userDataStore) {
          globalThis.userDataStore = {};
        }
        
        let userData = globalThis.userDataStore[userKey] || {
          dailyChats: 0,
          consecutiveDays: 1,
          lastChatDate: today
        };

        userData.dailyChats += 1;
        
        if (userData.lastChatDate !== today) {
          const lastDate = new Date(userData.lastChatDate);
          const currentDate = new Date(today);
          const dayDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
          
          if (dayDiff === 1) {
            userData.consecutiveDays += 1;
          } else if (dayDiff > 1) {
            userData.consecutiveDays = 1;
          }
          
          userData.lastChatDate = today;
        }
        
        // Save updated data
        globalThis.userDataStore[userKey] = userData;

        return new Response(JSON.stringify({
          success: true,
          dailyChats: userData.dailyChats,
          consecutiveDays: userData.consecutiveDays,
          maxDailyChats: 5
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (action === 'getUserStats') {
        const today = new Date().toISOString().split('T')[0];
        const userKey = `user_${userId}_${today}`;
        
        if (!globalThis.userDataStore) {
          globalThis.userDataStore = {};
        }
        
        const userData = globalThis.userDataStore[userKey] || {
          dailyChats: 0,
          consecutiveDays: 1,
          maxDailyChats: 5
        };

        return new Response(JSON.stringify({
          success: true,
          dailyChats: userData.dailyChats,
          consecutiveDays: userData.consecutiveDays,
          maxDailyChats: userData.maxDailyChats
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
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
      console.error('User API error:', error);
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
