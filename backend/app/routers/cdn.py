"""
Chat CDN Router for Retail Flow.
Serves the standalone embeddable chat widget script (/cdn/v1/reroute-widget.js).
Guarantees persistent '⚡ Powered by Noesis Frameworks' branding on all storefront installations.
"""

from __future__ import annotations

import logging
from fastapi import APIRouter
from fastapi.responses import Response

log = logging.getLogger(__name__)
router = APIRouter(prefix="/cdn/v1", tags=["cdn"])

_WIDGET_JS = """\
(function() {
  if (window.__RETAIL_FLOW_WIDGET_LOADED__) return;
  window.__RETAIL_FLOW_WIDGET_LOADED__ = true;

  // Read config from script tag
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var storeKey = currentScript ? currentScript.getAttribute('data-store-key') || 'pk_live_demo' : 'pk_live_demo';
  var apiBase = currentScript ? currentScript.getAttribute('data-api-base') || window.location.origin : window.location.origin;
  var theme = currentScript ? currentScript.getAttribute('data-theme') || 'bright' : 'bright';

  // Inject CSS Styles
  var style = document.createElement('style');
  style.id = 'retail-flow-widget-styles';
  style.textContent = `
    .rf-widget-root {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #111827;
      box-sizing: border-box;
    }
    .rf-widget-root * { box-sizing: border-box; }
    .rf-launcher-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #FF5500;
      color: #ffffff;
      border: none;
      box-shadow: 0 8px 24px rgba(255, 85, 0, 0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
    }
    .rf-launcher-btn:hover {
      transform: scale(1.06);
      box-shadow: 0 12px 28px rgba(255, 85, 0, 0.45);
    }
    .rf-chat-window {
      position: absolute;
      bottom: 72px;
      right: 0;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 540px;
      max-height: calc(100vh - 100px);
      background: #FAF9F5;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.16);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(16px) scale(0.96);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .rf-chat-window.rf-open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    .rf-header {
      background: #FFFFFF;
      padding: 16px;
      border-bottom: 1px solid #EAE7DC;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .rf-header-title {
      font-weight: 700;
      font-size: 14px;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .rf-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10B981;
    }
    .rf-close-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: #9CA3AF;
      padding: 4px;
    }
    .rf-close-btn:hover { color: #111827; }
    .rf-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .rf-msg {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 14px;
      line-height: 1.45;
      font-size: 13px;
    }
    .rf-msg.assistant {
      background: #FFFFFF;
      border: 1px solid #EAE7DC;
      color: #1F2937;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .rf-msg.user {
      background: #FF5500;
      color: #FFFFFF;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .rf-msg-tool {
      background: #F3F4F6;
      border-left: 3px solid #FF5500;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      color: #4B5563;
      align-self: flex-start;
      max-width: 90%;
    }
    .rf-input-area {
      background: #FFFFFF;
      padding: 12px;
      border-top: 1px solid #EAE7DC;
      display: flex;
      gap: 8px;
    }
    .rf-input {
      flex: 1;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid #E5E7EB;
      font-size: 13px;
      outline: none;
      background: #FAF9F5;
    }
    .rf-input:focus { border-color: #FF5500; }
    .rf-send-btn {
      background: #FF5500;
      color: #FFFFFF;
      border: none;
      border-radius: 12px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
    }
    .rf-branding-footer {
      background: #FAF9F5;
      padding: 8px 16px;
      border-top: 1px solid #EAE7DC;
      text-align: center;
      font-size: 11px;
      color: #6B7280;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .rf-branding-footer a {
      color: #FF5500;
      text-decoration: none;
      font-weight: 600;
    }
    .rf-branding-footer a:hover {
      text-decoration: underline;
    }
    .rf-chips {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 4px 16px 12px;
      background: #FAF9F5;
    }
    .rf-chip {
      white-space: nowrap;
      background: #FFFFFF;
      border: 1px solid #EAE7DC;
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 11px;
      color: #4B5563;
      cursor: pointer;
    }
    .rf-chip:hover { border-color: #FF5500; color: #FF5500; }
  `;
  document.head.appendChild(style);

  // Build DOM Structure
  var root = document.createElement('div');
  root.className = 'rf-widget-root';
  root.innerHTML = `
    <div class="rf-chat-window" id="rf-chat-window">
      <div class="rf-header">
        <div class="rf-header-title">
          <span class="rf-status-dot"></span>
          <span>Order Exception Assistant</span>
        </div>
        <button class="rf-close-btn" id="rf-close-btn">&times;</button>
      </div>

      <div class="rf-messages" id="rf-messages">
        <div class="rf-msg assistant">
          Hello! I can inspect order tracking, initiate instant returns for damaged items, and check delivery status under store policies.
        </div>
      </div>

      <div class="rf-chips">
        <button class="rf-chip" data-msg="Where is my order? 949d5b44dbf5de83e3834f1643224b4c">📦 Track Package</button>
        <button class="rf-chip" data-msg="Item arrived broken and smashed in box. Order 949d5b44dbf5de83e3834f1643224b4c">💔 Damaged Item</button>
        <button class="rf-chip" data-msg="What is your return window?">📋 Return Policy</button>
      </div>

      <div class="rf-input-area">
        <input type="text" class="rf-input" id="rf-input" placeholder="Enter message or order ID..." />
        <button class="rf-send-btn" id="rf-send-btn">Send</button>
      </div>

      <div class="rf-branding-footer">
        <span>⚡ Powered by</span>
        <a href="https://noesisframeworks.com" target="_blank" rel="noopener noreferrer">Noesis Frameworks</a>
      </div>
    </div>

    <button class="rf-launcher-btn" id="rf-launcher-btn" aria-label="Open support assistant">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
  `;
  document.body.appendChild(root);

  // Logic & Interactivity
  var launcher = document.getElementById('rf-launcher-btn');
  var chatWindow = document.getElementById('rf-chat-window');
  var closeBtn = document.getElementById('rf-close-btn');
  var input = document.getElementById('rf-input');
  var sendBtn = document.getElementById('rf-send-btn');
  var messagesContainer = document.getElementById('rf-messages');

  var isOpen = false;
  var sessionMessages = [];

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      chatWindow.classList.add('rf-open');
      input.focus();
    } else {
      chatWindow.classList.remove('rf-open');
    }
  }

  launcher.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);

  // Handle Quick Chips
  var chips = root.querySelectorAll('.rf-chip');
  chips.forEach(function(chip) {
    chip.addEventListener('click', function() {
      var msg = chip.getAttribute('data-msg');
      if (msg) {
        input.value = msg;
        sendMessage();
      }
    });
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  sendBtn.addEventListener('click', sendMessage);

  function appendMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'rf-msg ' + role;
    div.textContent = text;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return div;
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text) return;
    input.value = '';

    appendMessage('user', text);
    sessionMessages.push({ role: 'user', content: text });

    // Show assistant bubble
    var assistantDiv = appendMessage('assistant', 'Thinking...');

    try {
      var response = await fetch(apiBase + '/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Store-Key': storeKey
        },
        body: JSON.stringify({
          session_id: 'cdn_' + Math.random().toString(36).substring(7),
          messages: sessionMessages
        })
      });

      if (response.status === 429) {
        assistantDiv.innerHTML = '⚠️ <strong>Free Tier Rate Limit Reached</strong><br>Quota exhausted for this store. Upgrade to Pro for unlimited dual-process deliberative reasoning.<br><br>⚡ Powered by <a href="https://noesisframeworks.com" target="_blank" style="color:#FF5500;">Noesis Frameworks</a>';
        return;
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buffer = '';
      var streamText = '';

      assistantDiv.textContent = '';

      while (true) {
        var result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\\n');
        buffer = lines.pop() || '';

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.startsWith('data: ')) {
            var jsonStr = line.slice(6);
            if (!jsonStr) continue;
            try {
              var evt = JSON.parse(jsonStr);
              if (evt.type === 'rate_limited') {
                assistantDiv.innerHTML = '⚠️ <strong>Free Plan Limit:</strong> ' + evt.content.message + '<br><br>⚡ Powered by <a href="https://noesisframeworks.com" target="_blank" style="color:#FF5500;">Noesis Frameworks</a>';
                return;
              } else if (evt.type === 'text') {
                streamText += evt.content;
                assistantDiv.textContent = streamText;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              } else if (evt.type === 'tool_result') {
                var toolDiv = document.createElement('div');
                toolDiv.className = 'rf-msg-tool';
                toolDiv.textContent = '⚡ Engine Verdict: ' + (evt.content.resolution || 'Resolved').toUpperCase() + ' (Policy: ' + (evt.content.applicable_rules || []).join(', ') + ')';
                messagesContainer.insertBefore(toolDiv, assistantDiv);
              }
            } catch (err) {}
          }
        }
      }

      sessionMessages.push({ role: 'assistant', content: streamText });
    } catch (err) {
      assistantDiv.textContent = 'Unable to reach exception engine. Please try again.';
    }
  }
})();
"""

@router.get("/reroute-widget.js", summary="Standalone Embeddable Chat Widget CDN Script")
async def get_widget_js():
    """
    Returns the standalone, dependency-free vanilla JS widget.
    Stores can embed this via a single <script> tag on Shopify, WooCommerce, or custom sites.
    Always includes persistent 'Powered by Noesis Frameworks' branding.
    """
    return Response(
        content=_WIDGET_JS,
        media_type="application/javascript",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
        },
    )
