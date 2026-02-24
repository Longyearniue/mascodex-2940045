import { jsonResponse, errorResponse, corsResponse, getPlayerId, getTodayJST } from '../_lib/helpers.js';
import { getElement, getDamageMultiplier } from '../_lib/elements.js';
import { getStatusFromHp } from '../_lib/districts.js';
import { getRandomQuiz } from '../_lib/quizzes.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    const player = await env.GAME_DB.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first();
    if (!player) return errorResponse('Not registered', 403);

    const body = await request.json();
    const today = getTodayJST();

    if (body.action === 'get') {
      // Check daily quiz count (max 5)
      const countResult = await env.GAME_DB.prepare(
        "SELECT COUNT(*) as count FROM actions WHERE player_id = ? AND action_type = 'quiz' AND date(created_at) = date('now')"
      ).bind(playerId).first();
      const quizCount = countResult?.count || 0;
      if (quizCount >= 5) return jsonResponse({ success: false, error: 'Daily quiz limit reached', remaining: 0 });

      const quiz = getRandomQuiz(player.prefecture);
      // Store quiz in GAME_KV with short TTL for answer verification
      const quizId = crypto.randomUUID();
      await env.GAME_KV.put(`quiz_${playerId}_${quizId}`, JSON.stringify(quiz), { expirationTtl: 300 });

      return jsonResponse({
        success: true,
        quizId,
        question: quiz.q,
        options: quiz.options,
        prefecture: quiz.prefecture || player.prefecture,
        remaining: 5 - quizCount - 1,
      });
    }

    if (body.action === 'answer') {
      const { quizId, answer } = body;
      if (quizId === undefined || answer === undefined) return errorResponse('Missing quizId or answer');

      // Get quiz from KV
      const quizData = await env.GAME_KV.get(`quiz_${playerId}_${quizId}`, { type: 'json' });
      if (!quizData) return errorResponse('Quiz expired or invalid');

      // Delete quiz from KV (one-time use)
      await env.GAME_KV.delete(`quiz_${playerId}_${quizId}`);

      const isCorrect = answer === quizData.correct;
      let hpGiven = 0;
      let xpEarned = 0;
      let bonusMultiplier = 1.0;

      if (isCorrect) {
        // Check for element matchup bonus against current amoeba
        const playerElement = getElement(player.prefecture);
        const activeAmoeba = await env.GAME_DB.prepare(
          "SELECT * FROM amoebas WHERE is_active = 1 AND current_districts LIKE ? LIMIT 1"
        ).bind(`%"${player.district}"%`).first();

        if (activeAmoeba) {
          bonusMultiplier = getDamageMultiplier(playerElement, activeAmoeba.type);
        }

        hpGiven = Math.round(25 * bonusMultiplier);
        xpEarned = 15;

        // Update district HP
        await env.GAME_DB.prepare(
          'UPDATE districts SET hp = MIN(hp + ?, max_hp), last_updated = datetime("now") WHERE code = ?'
        ).bind(hpGiven, player.district).run();

        // Update player XP and defense
        await env.GAME_DB.prepare(
          'UPDATE players SET xp = xp + ?, total_defense = total_defense + ? WHERE id = ?'
        ).bind(xpEarned, hpGiven, playerId).run();

        // Record action
        await env.GAME_DB.prepare(
          'INSERT INTO actions (player_id, action_type, district_code, hp_given, xp_earned, metadata) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(playerId, 'quiz', player.district, hpGiven, xpEarned, JSON.stringify({ correct: true, bonus: bonusMultiplier })).run();

        // Damage the amoeba if one is present
        if (activeAmoeba) {
          await env.GAME_DB.prepare(
            'UPDATE amoebas SET hp = MAX(hp - ?, 0) WHERE id = ?'
          ).bind(hpGiven, activeAmoeba.id).run();
        }
      }

      const district = await env.GAME_DB.prepare('SELECT * FROM districts WHERE code = ?').bind(player.district).first();

      return jsonResponse({
        success: true,
        correct: isCorrect,
        correctAnswer: quizData.correct,
        hpGiven,
        xpEarned,
        bonusMultiplier,
        district: district ? {
          code: district.code,
          hp: district.hp,
          maxHp: district.max_hp,
          status: getStatusFromHp(district.hp, district.max_hp),
        } : null,
      });
    }

    return errorResponse('Invalid action. Use "get" or "answer"');
  } catch (err) {
    console.error('Quiz action error:', err);
    return errorResponse('Internal server error', 500);
  }
}
