// src/webhooks/telnyx.ts – Telnyx voice webhook handler
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  TELNYX_API_KEY: string;
  TELNYX_CONNECTION_ID: string;
  TELNYX_FROM_NUMBER: string;
  GOOGLE_PLACES_API_KEY: string;
  CORS_ORIGIN: string;
};

interface ClientState {
  call_id: string;
  session_id: string;
  type: 'lifecall';
}

interface TelnyxEvent {
  data: {
    event_type: string;
    payload: {
      call_control_id: string;
      call_leg_id?: string;
      client_state?: string;
      from?: string;
      to?: string;
      result?: string; // for machine detection: 'machine' | 'human' | 'not_sure'
      hangup_cause?: string;
      hangup_source?: string;
      ai_summary?: string;
    };
  };
}

type CallOutcome =
  | 'booked'
  | 'available'
  | 'unavailable'
  | 'over_budget'
  | 'voicemail'
  | 'no_answer'
  | 'call_back_later'
  | 'unknown';

// ─── Helper: decode client state from base64 ────────────────────────────────
function decodeClientState(encoded?: string): ClientState | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(atob(encoded));
    if (parsed.type !== 'lifecall') return null;
    return parsed as ClientState;
  } catch {
    return null;
  }
}

// ─── Helper: detect outcome from AI summary keywords ────────────────────────
function detectOutcome(summary: string): CallOutcome {
  const lower = summary.toLowerCase();

  // Check in priority order
  if (lower.includes('confirmed') || lower.includes('booked')) {
    return 'booked';
  }
  if (lower.includes('over budget')) {
    return 'over_budget';
  }
  if (lower.includes('call back later')) {
    return 'call_back_later';
  }
  if (
    lower.includes('unavailable') ||
    lower.includes('full') ||
    lower.includes('sold out') ||
    lower.includes('no available') ||
    lower.includes('not available')
  ) {
    return 'unavailable';
  }
  if (lower.includes('voicemail')) {
    return 'voicemail';
  }
  if (lower.includes('no answer')) {
    return 'no_answer';
  }
  if (lower.includes('available')) {
    return 'available';
  }

  return 'unknown';
}

// ─── Helper: handle call completion and session state transitions ───────────
async function handleCallCompletion(
  db: D1Database,
  sessionId: string,
  callId: string,
  outcome: CallOutcome,
): Promise<void> {
  const now = new Date().toISOString();

  // If the call resulted in a booking, complete the session
  if (outcome === 'booked') {
    await db
      .prepare(
        `UPDATE lifecall_sessions SET status = 'completed', updated_at = ? WHERE id = ?`,
      )
      .bind(now, sessionId)
      .run();
    return;
  }

  // Check if there are more pending calls for this session
  const pendingCall = await db
    .prepare(
      `SELECT id FROM lifecall_calls
       WHERE session_id = ? AND status = 'pending'
       ORDER BY call_order ASC
       LIMIT 1`,
    )
    .bind(sessionId)
    .first<{ id: string }>();

  if (pendingCall) {
    // More calls to try — session stays in 'calling' status
    return;
  }

  // No more pending calls and no booking — mark session as failed
  // This will trigger auto-refund from the frontend
  await db
    .prepare(
      `UPDATE lifecall_sessions SET status = 'failed', updated_at = ? WHERE id = ?`,
    )
    .bind(now, sessionId)
    .run();
}

// ─── Webhook router ─────────────────────────────────────────────────────────
export const telnyxWebhook = new Hono<{ Bindings: Env }>();

telnyxWebhook.post('/', async (c) => {
  let event: TelnyxEvent;
  try {
    event = await c.req.json<TelnyxEvent>();
  } catch {
    return c.text('Invalid JSON', 400);
  }

  const { event_type, payload } = event.data;
  const { call_control_id, client_state } = payload;
  const state = decodeClientState(client_state);

  // Ignore events that are not for lifecall
  if (!state) {
    return c.text('OK', 200);
  }

  const db = c.env.DB;
  const now = new Date().toISOString();

  switch (event_type) {
    // ── Call initiated ───────────────────────────────────────────────────
    case 'call.initiated': {
      await db
        .prepare(
          `UPDATE lifecall_calls SET status = 'calling', telnyx_call_id = ? WHERE id = ?`,
        )
        .bind(call_control_id, state.call_id)
        .run();
      break;
    }

    // ── Call answered ────────────────────────────────────────────────────
    case 'call.answered': {
      // AI handles the conversation from here — no action needed
      break;
    }

    // ── Call hangup ──────────────────────────────────────────────────────
    case 'call.hangup': {
      const summary = payload.ai_summary || '';
      const outcome = summary ? detectOutcome(summary) : 'no_answer';

      // Update call record with result
      await db
        .prepare(
          `UPDATE lifecall_calls
              SET status = 'completed',
                  outcome = ?,
                  ai_summary = ?
            WHERE id = ?`,
        )
        .bind(outcome, summary || null, state.call_id)
        .run();

      // Handle session state transitions
      await handleCallCompletion(db, state.session_id, state.call_id, outcome);
      break;
    }

    // ── Answering machine detection ──────────────────────────────────────
    case 'call.machine.detection.ended': {
      const result = payload.result;

      if (result === 'machine') {
        // Voicemail detected — hang up and mark call
        await db
          .prepare(
            `UPDATE lifecall_calls
                SET status = 'completed',
                    outcome = 'voicemail',
                    ai_summary = 'Answering machine detected, call ended automatically.'
              WHERE id = ?`,
          )
          .bind(state.call_id)
          .run();

        // Hang up the call
        await fetch(
          `https://api.telnyx.com/v2/calls/${call_control_id}/actions/hangup`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ client_state }),
          },
        );

        // Handle session state transitions
        await handleCallCompletion(
          db,
          state.session_id,
          state.call_id,
          'voicemail',
        );
      }
      // If 'human' or 'not_sure', let the AI conversation continue
      break;
    }

    default: {
      // Unknown event type — log and acknowledge
      console.log(`Unhandled Telnyx event: ${event_type}`);
      break;
    }
  }

  return c.text('OK', 200);
});
