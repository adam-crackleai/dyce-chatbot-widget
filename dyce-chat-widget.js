(function () {
  "use strict";

  // ── Configuration ──────────────────────────────────────────────────
  var WEBHOOK_URL = "https://adamyoung.app.n8n.cloud/webhook/dyce-chatbot-webhook/chat";
  var LOGO_URL = "https://dyce-energy.co.uk/wp-content/uploads/2024/02/white-pinnk.png";
  var REQUEST_TIMEOUT = 60000;

  // ── State ──────────────────────────────────────────────────────────
  var isOpen = false;
  var isSending = false;
  var sessionId = generateSessionId();
  var messages = [];

  // ── Helpers ────────────────────────────────────────────────────────
  function generateSessionId() {
    return "dyce-" + Date.now() + "-" + Math.random().toString(36).substring(2, 11);
  }

  // ── Load Poppins font (must be at document level for Shadow DOM access)
  if (!document.querySelector('link[href*="Poppins"]')) {
    var fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap";
    document.head.appendChild(fontLink);
  }

  // ── Styles (injected into Shadow DOM) ──────────────────────────────
  var CSS = [
    ":host { all: initial; }",

    "*, *::before, *::after {",
    "  box-sizing: border-box;",
    "  margin: 0;",
    "  padding: 0;",
    "  font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;",
    "  line-height: 1.4;",
    "}",

    /* Pulse ring animation */
    "@keyframes dyce-pulse {",
    "  0% { transform: scale(1); opacity: 0.4; }",
    "  100% { transform: scale(1.5); opacity: 0; }",
    "}",
    ".dyce-pulse-ring {",
    "  position: absolute;",
    "  inset: 0;",
    "  border-radius: 16px;",
    "  background: rgba(222, 0, 185, 0.25);",
    "  animation: dyce-pulse 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;",
    "  pointer-events: none;",
    "}",

    /* Toggle button — minimised state */
    ".dyce-toggle {",
    "  position: fixed;",
    "  bottom: 24px;",
    "  right: 24px;",
    "  width: 72px;",
    "  height: 72px;",
    "  background: #ffffff;",
    "  border: 1px solid rgba(222, 0, 185, 0.15);",
    "  border-radius: 16px;",
    "  cursor: pointer;",
    "  display: flex;",
    "  flex-direction: column;",
    "  align-items: center;",
    "  justify-content: center;",
    "  gap: 4px;",
    "  box-shadow: 0 4px 20px rgba(222, 0, 185, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);",
    "  z-index: 99998;",
    "  transition: transform 0.2s ease, box-shadow 0.2s ease;",
    "}",
    ".dyce-toggle:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(222, 0, 185, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1); }",
    ".dyce-toggle-icon { width: 32px; height: 32px; }",
    ".dyce-toggle-label {",
    "  font-size: 11px;",
    "  font-weight: 700;",
    "  color: #de00b9;",
    "  letter-spacing: 0.5px;",
    "}",

    /* Chat panel — open state */
    ".dyce-panel {",
    "  position: fixed;",
    "  bottom: 24px;",
    "  right: 24px;",
    "  width: 380px;",
    "  height: 560px;",
    "  max-height: calc(100vh - 48px);",
    "  background: #f0e6f6;",
    "  border-radius: 16px;",
    "  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);",
    "  display: none;",
    "  flex-direction: column;",
    "  overflow: hidden;",
    "  z-index: 99999;",
    "}",
    ".dyce-panel.open { display: flex; }",

    /* Header */
    ".dyce-header {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  padding: 16px 16px 14px;",
    "  position: relative;",
    "  background: #1a1a2e;",
    "  border-bottom: none;",
    "}",
    ".dyce-logo { height: 36px; width: auto; }",
    ".dyce-close {",
    "  position: absolute;",
    "  right: 12px;",
    "  top: 50%;",
    "  transform: translateY(-50%);",
    "  background: none;",
    "  border: none;",
    "  cursor: pointer;",
    "  font-size: 22px;",
    "  color: rgba(255,255,255,0.7);",
    "  width: 32px;",
    "  height: 32px;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  border-radius: 50%;",
    "  font-family: inherit;",
    "}",
    ".dyce-close:hover { background: rgba(255,255,255,0.1); color: #ffffff; }",

    /* Title bar */
    ".dyce-title {",
    "  padding: 10px 16px;",
    "  font-size: 13px;",
    "  font-weight: 600;",
    "  color: #2d2d3d;",
    "  background: #f0e6f6;",
    "  letter-spacing: 0.2px;",
    "}",

    /* Messages area */
    ".dyce-messages {",
    "  flex: 1;",
    "  overflow-y: auto;",
    "  padding: 16px;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 12px;",
    "}",

    /* Message bubbles */
    ".dyce-msg {",
    "  max-width: 85%;",
    "  padding: 12px 16px;",
    "  border-radius: 12px;",
    "  font-size: 14px;",
    "  color: #2d2d3d;",
    "  word-wrap: break-word;",
    "  white-space: pre-wrap;",
    "}",
    ".dyce-msg a {",
    "  color: #de00b9;",
    "  text-decoration: underline;",
    "  word-break: break-all;",
    "}",
    ".dyce-msg-bot {",
    "  background: #ffffff;",
    "  align-self: flex-start;",
    "  border-bottom-left-radius: 4px;",
    "}",
    ".dyce-msg-user {",
    "  background: #de00b9;",
    "  color: #ffffff;",
    "  align-self: flex-end;",
    "  border-bottom-right-radius: 4px;",
    "}",

    /* Typing indicator */
    ".dyce-typing {",
    "  display: flex;",
    "  gap: 4px;",
    "  padding: 12px 16px;",
    "  background: #ffffff;",
    "  align-self: flex-start;",
    "  border-radius: 12px;",
    "  border-bottom-left-radius: 4px;",
    "}",
    ".dyce-typing-dot {",
    "  width: 8px;",
    "  height: 8px;",
    "  background: #ccc;",
    "  border-radius: 50%;",
    "  animation: dyce-bounce 1.2s infinite ease-in-out;",
    "}",
    ".dyce-typing-dot:nth-child(2) { animation-delay: 0.2s; }",
    ".dyce-typing-dot:nth-child(3) { animation-delay: 0.4s; }",
    "@keyframes dyce-bounce {",
    "  0%, 60%, 100% { transform: translateY(0); }",
    "  30% { transform: translateY(-6px); }",
    "}",

    /* Input area */
    ".dyce-input-area {",
    "  display: flex;",
    "  align-items: center;",
    "  padding: 12px;",
    "  background: #ffffff;",
    "  border-top: 1px solid #e8ddf0;",
    "  gap: 8px;",
    "}",
    ".dyce-input {",
    "  flex: 1;",
    "  border: none;",
    "  outline: none;",
    "  font-size: 14px;",
    "  color: #2d2d3d;",
    "  background: transparent;",
    "  padding: 8px 4px;",
    "  font-family: inherit;",
    "}",
    ".dyce-input::placeholder { color: #999; }",
    ".dyce-input:disabled { opacity: 0.5; }",
    ".dyce-send {",
    "  background: none;",
    "  border: none;",
    "  cursor: pointer;",
    "  padding: 6px;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "}",
    ".dyce-send:disabled { opacity: 0.3; cursor: default; }",
    ".dyce-send svg { width: 20px; height: 20px; fill: #666; transition: fill 0.2s; }",
    ".dyce-send:not(:disabled):hover svg { fill: #de00b9; }",

    /* Mobile responsive */
    "@media (max-width: 480px) {",
    "  .dyce-panel {",
    "    width: calc(100vw - 16px);",
    "    height: calc(100vh - 16px);",
    "    bottom: 8px;",
    "    right: 8px;",
    "    border-radius: 12px;",
    "  }",
    "}"
  ].join("\n");

  // ── Create Shadow DOM host ─────────────────────────────────────────
  var host = document.createElement("div");
  host.id = "dyce-chat-widget";
  host.style.cssText = "all: initial; position: fixed; z-index: 99998; bottom: 0; right: 0; pointer-events: none;";
  document.body.appendChild(host);

  var shadow = host.attachShadow({ mode: "closed" });

  var styleEl = document.createElement("style");
  styleEl.textContent = CSS;
  shadow.appendChild(styleEl);

  // ── Build DOM inside Shadow Root ───────────────────────────────────

  // Toggle button
  var toggle = document.createElement("button");
  toggle.className = "dyce-toggle";
  toggle.setAttribute("aria-label", "Open chat");
  toggle.style.pointerEvents = "auto";
  toggle.innerHTML = [
    '<svg class="dyce-toggle-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '  <rect x="7" y="12" width="18" height="11" rx="5.5" fill="#d0d0d0"/>',
    '  <path d="M14 23l-1.5 3.5L17 23" fill="#d0d0d0"/>',
    '  <circle cx="13.5" cy="17.5" r="1.3" fill="#555"/>',
    '  <circle cx="18.5" cy="17.5" r="1.3" fill="#555"/>',
    '  <path d="M13 8.5c.8-1.5 1.8-2.2 3-2.2s2.2.7 3 2.2" stroke="#de00b9" stroke-width="2" stroke-linecap="round" fill="none"/>',
    '  <path d="M10.8 6c1.2-2 2.8-3 5.2-3s4 1 5.2 3" stroke="#de00b9" stroke-width="2" stroke-linecap="round" fill="none"/>',
    '</svg>',
    '<span class="dyce-toggle-label">CHAT</span>',
    '<span class="dyce-pulse-ring"></span>'
  ].join("");
  shadow.appendChild(toggle);

  var pulseRing = shadow.querySelector(".dyce-pulse-ring");

  // Chat panel
  var panel = document.createElement("div");
  panel.className = "dyce-panel";
  panel.style.pointerEvents = "auto";
  panel.innerHTML = [
    '<div class="dyce-header">',
    '  <img class="dyce-logo" src="' + LOGO_URL + '" alt="Dyce Energy">',
    '  <button class="dyce-close" aria-label="Close chat">&times;</button>',
    '</div>',
    '<div class="dyce-title">Dyce Energy Website Chatbot</div>',
    '<div class="dyce-messages"></div>',
    '<div class="dyce-input-area">',
    '  <input class="dyce-input" type="text" placeholder="Ask me anything" autocomplete="off">',
    '  <button class="dyce-send" aria-label="Send message">',
    '    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
    '      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>',
    '    </svg>',
    '  </button>',
    '</div>'
  ].join("");
  shadow.appendChild(panel);

  // ── References (inside shadow) ─────────────────────────────────────
  var messagesEl = shadow.querySelector(".dyce-messages");
  var inputEl = shadow.querySelector(".dyce-input");
  var sendBtn = shadow.querySelector(".dyce-send");
  var closeBtn = shadow.querySelector(".dyce-close");

  // ── URL linkification ──────────────────────────────────────────────
  function linkify(text) {
    return text.replace(
      /(https?:\/\/[^\s,)]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  }

  // ── Actions ────────────────────────────────────────────────────────
  function openChat() {
    isOpen = true;
    panel.classList.add("open");
    toggle.style.display = "none";
    inputEl.focus();

    if (messages.length === 0) {
      addMessage("bot", "Hi. This is Dyce's virtual assistant. How can I help you today?");
    }
  }

  function closeChat() {
    isOpen = false;
    panel.classList.remove("open");
    toggle.style.display = "flex";
  }

  function addMessage(role, text) {
    messages.push({ role: role, text: text });

    var bubble = document.createElement("div");
    bubble.className = "dyce-msg dyce-msg-" + role;

    if (role === "bot") {
      bubble.innerHTML = linkify(text);
    } else {
      bubble.textContent = text;
    }

    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    var typing = document.createElement("div");
    typing.className = "dyce-typing";
    typing.setAttribute("data-typing", "true");
    typing.innerHTML = [
      '<div class="dyce-typing-dot"></div>',
      '<div class="dyce-typing-dot"></div>',
      '<div class="dyce-typing-dot"></div>'
    ].join("");
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var typing = shadow.querySelector("[data-typing]");
    if (typing) typing.remove();
  }

  function setInputEnabled(enabled) {
    inputEl.disabled = !enabled;
    sendBtn.disabled = !enabled;
  }

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || isSending) return;

    addMessage("user", text);
    inputEl.value = "";
    isSending = true;
    setInputEnabled(false);
    showTyping();

    if (!WEBHOOK_URL) {
      hideTyping();
      isSending = false;
      setInputEnabled(true);
      addMessage("bot", "Chat is not yet connected. Please check back soon.");
      return;
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT);

    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        chatInput: text,
        action: "sendMessage"
      }),
      signal: controller.signal
    })
      .then(function (res) {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        hideTyping();
        isSending = false;
        setInputEnabled(true);
        inputEl.focus();

        var reply = data.output || data.reply || data.response || "";
        if (reply) {
          addMessage("bot", reply);
        } else {
          addMessage("bot", "Sorry, I didn't get a response. Please try again.");
        }
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        hideTyping();
        isSending = false;
        setInputEnabled(true);
        inputEl.focus();

        if (err.name === "AbortError") {
          addMessage("bot", "Sorry, the response took too long. Please try again or call us on 01709 357315.");
        } else {
          addMessage("bot", "Sorry, something went wrong. Please try again or call us on 01709 357315.");
        }
      });
  }

  // ── Event Listeners ────────────────────────────────────────────────
  toggle.addEventListener("click", openChat);
  closeBtn.addEventListener("click", closeChat);
  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) sendMessage();
  });
})();
