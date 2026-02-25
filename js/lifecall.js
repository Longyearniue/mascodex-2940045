(function() {
  'use strict';

  var LIFECALL_API = 'https://lifecall-worker.taiichifox.workers.dev';
  var STRIPE_PK = ''; // Set after Stripe account setup
  var stripe = null;
  var currentSession = null;
  var locale = (navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en';

  // Override existing sendChat defined in template.js inline script
  window.sendChat = async function() {
    var input = document.getElementById('chatInput');
    var msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    var msgs = document.getElementById('chatMessages');

    // Show user message
    var userEl = document.createElement('div');
    userEl.className = 'chat-msg user';
    userEl.textContent = msg;
    msgs.appendChild(userEl);

    // Show typing indicator
    var typingEl = document.createElement('div');
    typingEl.className = 'chat-msg bot typing';
    typingEl.textContent = CHAR_NAME + (locale === 'ja' ? 'が考え中...' : ' is thinking...');
    msgs.appendChild(typingEl);
    msgs.scrollTop = msgs.scrollHeight;

    chatHistory.push({ role: 'user', content: msg });
    if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

    var btn = document.getElementById('chatSend');
    btn.disabled = true;

    try {
      // If in hearing mode, handle field collection instead of normal chat
      if (currentSession && currentSession.status === 'hearing') {
        await handleHearingResponse(msg, msgs, typingEl);
        btn.disabled = false;
        return;
      }

      // Normal chat request to existing API
      var res = await fetch(API + '/' + POSTAL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chatHistory })
      });
      var data = await res.json();
      typingEl.remove();

      var botEl = document.createElement('div');
      botEl.className = 'chat-msg bot';
      botEl.textContent = data.response || (locale === 'ja' ? 'ごめんね、うまく答えられなかったよ。' : "Sorry, I couldn't respond.");
      msgs.appendChild(botEl);
      chatHistory.push({ role: 'assistant', content: data.response || '' });

      // Check for concierge trigger from chat API response
      if (data.concierge && data.concierge.action === 'start_concierge') {
        await startConciergeMode(data.concierge.category, msg, msgs);
      }
    } catch (e) {
      typingEl.remove();
      var errEl = document.createElement('div');
      errEl.className = 'chat-msg bot';
      errEl.textContent = locale === 'ja'
        ? 'ごめんなさい、今お話しできないみたい。また後で話しかけてね！'
        : 'Sorry, I can\'t talk right now. Please try again later!';
      msgs.appendChild(errEl);
    }
    msgs.scrollTop = msgs.scrollHeight;
    btn.disabled = false;
  };

  // Start concierge mode: show category info, price, disclaimer, then begin hearing
  async function startConciergeMode(categoryId, originalMessage, msgs) {
    try {
      var res = await fetch(LIFECALL_API + '/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postal_code: POSTAL, message: originalMessage, locale: locale })
      });
      var data = await res.json();
      if (data.action !== 'concierge_start') return;

      currentSession = {
        id: data.session_id,
        category: data.category,
        price: data.price,
        fields: data.fields,
        collected: {},
        currentFieldIndex: 0,
        status: 'hearing'
      };

      // Show info card with category, price, and disclaimer
      var infoEl = document.createElement('div');
      infoEl.className = 'chat-msg bot';
      infoEl.innerHTML = '<div style="background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.2);border-radius:12px;padding:12px;">' +
        '<strong>' + data.category_name + '</strong><br>' +
        (locale === 'ja' ? '料金: ' : 'Fee: ') + '&yen;' + data.price + '<br>' +
        '<small style="color:rgba(255,255,255,0.5);">' +
        (locale === 'ja' ? '※連絡代行のみ。医療・法律の助言は行いません。' : '※Call assistance only. No medical/legal advice.') +
        '</small></div>';
      msgs.appendChild(infoEl);

      // Begin asking fields
      askNextField(msgs);
    } catch (e) {
      console.error('Concierge start error:', e);
    }
  }

  // Ask the next hearing field, or submit if all fields collected
  function askNextField(msgs) {
    if (!currentSession) return;
    var fields = currentSession.fields;
    var idx = currentSession.currentFieldIndex;

    if (idx >= fields.length) {
      submitHearing(msgs);
      return;
    }

    var field = fields[idx];
    var questionEl = document.createElement('div');
    questionEl.className = 'chat-msg bot';
    questionEl.textContent = field.label + (field.required ? '' : (locale === 'ja' ? '（スキップ可）' : ' (optional, type "skip")'));
    msgs.appendChild(questionEl);
    msgs.scrollTop = msgs.scrollHeight;
  }

  // Handle user response during hearing mode
  async function handleHearingResponse(msg, msgs, typingEl) {
    typingEl.remove();
    if (!currentSession) return;

    var field = currentSession.fields[currentSession.currentFieldIndex];

    // Allow skipping optional fields
    if ((msg.toLowerCase() === 'skip' || msg === 'スキップ') && !field.required) {
      currentSession.currentFieldIndex++;
      askNextField(msgs);
      return;
    }

    // Collect the field value
    currentSession.collected[field.key] = msg;
    currentSession.currentFieldIndex++;

    var ackEl = document.createElement('div');
    ackEl.className = 'chat-msg bot';
    ackEl.textContent = locale === 'ja' ? 'わかった！' : 'Got it!';
    msgs.appendChild(ackEl);

    askNextField(msgs);
  }

  // Submit all collected hearing data and transition to payment
  async function submitHearing(msgs) {
    var readyEl = document.createElement('div');
    readyEl.className = 'chat-msg bot';
    readyEl.textContent = CHAR_NAME + (locale === 'ja'
      ? ': 情報ありがとう！電話の準備ができたよ。お支払いをお願いね！'
      : ': Thanks! Ready to call. Please complete the payment!');
    msgs.appendChild(readyEl);

    await fetch(LIFECALL_API + '/api/sessions/' + currentSession.id + '/hearing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSession.collected)
    });

    currentSession.status = 'payment';
    showPaymentUI(msgs);
  }

  // Render inline Stripe Payment Element in the chat
  function showPaymentUI(msgs) {
    var payDiv = document.createElement('div');
    payDiv.className = 'chat-msg bot';
    payDiv.id = 'lifecall-payment';
    payDiv.innerHTML = '<div style="background:rgba(255,255,255,0.08);border-radius:12px;padding:16px;">' +
      '<div style="font-weight:700;margin-bottom:12px;">' + (locale === 'ja' ? 'お支払い' : 'Payment') + ' &yen;' + currentSession.price + '</div>' +
      '<div id="stripe-element" style="min-height:40px;margin-bottom:12px;"></div>' +
      '<button id="lifecall-pay-btn" style="width:100%;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;font-size:0.9rem;">' +
      (locale === 'ja' ? 'お支払い' : 'Pay Now') + '</button>' +
      '<button id="lifecall-cancel-btn" style="width:100%;padding:8px;background:none;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:rgba(255,255,255,0.5);margin-top:8px;cursor:pointer;font-size:0.85rem;">' +
      (locale === 'ja' ? 'キャンセル' : 'Cancel') + '</button></div>';
    msgs.appendChild(payDiv);
    msgs.scrollTop = msgs.scrollHeight;

    initStripePayment();
  }

  // Initialize Stripe Elements and attach payment handlers
  async function initStripePayment() {
    if (!stripe && STRIPE_PK) {
      stripe = Stripe(STRIPE_PK);
    }

    var res = await fetch(LIFECALL_API + '/api/payment/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: currentSession.id })
    });
    var data = await res.json();

    if (!stripe || !data.client_secret) {
      document.getElementById('stripe-element').textContent =
        locale === 'ja' ? '決済準備中にエラーが発生しました' : 'Payment setup error';
      return;
    }

    var elements = stripe.elements({ clientSecret: data.client_secret });
    var paymentElement = elements.create('payment');
    paymentElement.mount('#stripe-element');

    document.getElementById('lifecall-pay-btn').onclick = async function() {
      this.disabled = true;
      this.textContent = locale === 'ja' ? '処理中...' : 'Processing...';

      var result = await stripe.confirmPayment({
        elements: elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required'
      });

      if (result.error) {
        this.disabled = false;
        this.textContent = locale === 'ja' ? 'お支払い' : 'Pay Now';
        alert(result.error.message);
      } else {
        onPaymentSuccess();
      }
    };

    document.getElementById('lifecall-cancel-btn').onclick = function() {
      currentSession = null;
      var el = document.getElementById('lifecall-payment');
      if (el) el.remove();
      addBotMsg(CHAR_NAME + (locale === 'ja' ? ': キャンセルしたよ！また何かあったら言ってね。' : ': Cancelled! Let me know if you need help.'));
    };
  }

  // Handle successful payment: confirm with backend, initiate call
  async function onPaymentSuccess() {
    var el = document.getElementById('lifecall-payment');
    if (el) el.remove();

    await fetch(LIFECALL_API + '/api/payment/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: currentSession.id })
    });

    addBotMsg(CHAR_NAME + (locale === 'ja' ? ': お支払い完了！今から電話するね！' : ': Payment done! Calling now!'));

    currentSession.status = 'calling';

    await fetch(LIFECALL_API + '/api/calls/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: currentSession.id })
    });

    pollCallStatus();
  }

  // Poll session status every 3 seconds during calls
  function pollCallStatus() {
    var msgs = document.getElementById('chatMessages');
    var statusEl = document.createElement('div');
    statusEl.className = 'chat-msg bot';
    statusEl.id = 'lifecall-call-status';
    statusEl.textContent = locale === 'ja' ? '電話中...' : 'Calling...';
    msgs.appendChild(statusEl);
    msgs.scrollTop = msgs.scrollHeight;

    var pollInterval = setInterval(async function() {
      try {
        var res = await fetch(LIFECALL_API + '/api/sessions/' + currentSession.id);
        var data = await res.json();
        var session = data.session;
        var calls = data.calls || [];

        var lines = calls.map(function(c) {
          var icon = c.status === 'completed' ? (c.outcome === 'booked' ? '[OK]' : '[NG]') : c.status === 'calling' ? '[...]' : '[wait]';
          return icon + ' ' + c.target_name;
        });
        statusEl.innerHTML = lines.join('<br>') || (locale === 'ja' ? '電話中...' : 'Calling...');

        if (session.status === 'completed' || session.status === 'failed') {
          clearInterval(pollInterval);
          showResult(session, calls);
        }
      } catch (e) {
        // Keep polling on transient errors
      }
    }, 3000);
  }

  // Show final result card (success with details or failure with refund notice)
  function showResult(session, calls) {
    var el = document.getElementById('lifecall-call-status');
    if (el) el.remove();

    var booked = calls.find(function(c) { return c.outcome === 'booked'; });
    var html;

    if (booked) {
      html = '<div style="background:rgba(102,234,126,0.12);border:1px solid rgba(102,234,126,0.25);border-radius:12px;padding:12px;">' +
        '<strong>' + (locale === 'ja' ? '完了！' : 'Done!') + '</strong><br>' +
        '<strong>' + booked.target_name + '</strong>' +
        (booked.ai_summary ? '<br><small>' + booked.ai_summary + '</small>' : '') +
        (booked.price_quoted ? '<br>' + booked.price_quoted : '') + '</div>';
    } else {
      html = '<div style="background:rgba(234,102,102,0.12);border:1px solid rgba(234,102,102,0.25);border-radius:12px;padding:12px;">' +
        '<strong>' + (locale === 'ja' ? '残念、予約できなかったよ...' : 'Sorry, couldn\'t complete the request...') + '</strong><br>' +
        (locale === 'ja' ? '全額返金するね！' : 'You\'ll get a full refund!') + '</div>';
    }

    addBotMsg(html, true);
    currentSession = null;
  }

  // Helper: append a bot message to the chat
  function addBotMsg(content, isHtml) {
    var msgs = document.getElementById('chatMessages');
    var el = document.createElement('div');
    el.className = 'chat-msg bot';
    if (isHtml) {
      el.innerHTML = content;
    } else {
      el.textContent = content;
    }
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

})();
