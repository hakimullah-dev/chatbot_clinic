const STORAGE_KEY = "aria-live-test-session";
const DEFAULT_WEBHOOK =
  "https://n8n.srv1504760.hstgr.cloud/webhook/online-appointment-system";

const elements = {
  webhookUrl: document.getElementById("webhookUrl"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  messages: document.getElementById("messages"),
  chatForm: document.getElementById("chatForm"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  promptGrid: document.getElementById("promptGrid"),
  sessionIdLabel: document.getElementById("sessionIdLabel"),
  historyCount: document.getElementById("historyCount"),
  newSessionBtn: document.getElementById("newSessionBtn"),
  clearChatBtn: document.getElementById("clearChatBtn"),
  playLastAudioBtn: document.getElementById("playLastAudioBtn"),
  slotPickerPanel: document.getElementById("slotPickerPanel"),
  messageTemplate: document.getElementById("messageTemplate"),
};

const state = {
  webhookUrl: DEFAULT_WEBHOOK,
  sessionId: "",
  history: [],
  messages: [],
  lastAudioBase64: "",
  sending: false,
};

function createSessionId() {
  return `aria_web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function syncStatus(text, tone = "ready") {
  elements.statusText.textContent = text;
  const palette = {
    ready: "#0d7a63",
    busy: "#d98545",
    error: "#b44040",
  };
  elements.statusDot.style.background = palette[tone] || palette.ready;
  elements.statusDot.style.boxShadow = `0 0 0 6px ${
    tone === "error"
      ? "rgba(180, 64, 64, 0.14)"
      : tone === "busy"
        ? "rgba(217, 133, 69, 0.14)"
        : "rgba(13, 122, 99, 0.12)"
  }`;
}

function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      webhookUrl: state.webhookUrl,
      sessionId: state.sessionId,
      history: state.history,
      messages: state.messages,
      lastAudioBase64: state.lastAudioBase64,
    }),
  );
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.sessionId = createSessionId();
    return;
  }

  try {
    const saved = JSON.parse(raw);
    state.webhookUrl = saved.webhookUrl || DEFAULT_WEBHOOK;
    state.sessionId = saved.sessionId || createSessionId();
    state.history = Array.isArray(saved.history) ? saved.history : [];
    state.messages = Array.isArray(saved.messages) ? saved.messages : [];
    state.lastAudioBase64 = saved.lastAudioBase64 || "";
  } catch {
    state.sessionId = createSessionId();
  }
}

function renderMessages() {
  elements.messages.innerHTML = "";

  if (state.messages.length === 0) {
    addMessage({
      role: "assistant",
      text:
        "Welcome. You can now test bookings, cancellations, reschedules, and voice replies from your live n8n workflow.",
      persist: false,
    });
    return;
  }

  for (const item of state.messages) {
    drawMessage(item.role, item.text);
  }

  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function drawMessage(role, text) {
  const fragment = elements.messageTemplate.content.cloneNode(true);
  const article = fragment.querySelector(".message");
  const meta = fragment.querySelector(".message-meta");
  const bubble = fragment.querySelector(".message-bubble");

  article.classList.add(role);
  meta.textContent =
    role === "user" ? "You" : role === "assistant" ? "Aria" : "System";
  bubble.textContent = text;
  elements.messages.appendChild(fragment);
}

function addMessage({ role, text, persist = true }) {
  if (persist) {
    state.messages.push({ role, text });
    persistState();
  }
  drawMessage(role, text);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function updateSessionUI() {
  elements.webhookUrl.value = state.webhookUrl;
  elements.sessionIdLabel.textContent = state.sessionId;
  elements.historyCount.textContent = String(state.history.length);
  elements.playLastAudioBtn.disabled = !state.lastAudioBase64;
}

function setComposerState(sending) {
  state.sending = sending;
  elements.sendBtn.disabled = sending;
  elements.messageInput.disabled = sending;
}

function resetSession(clearMessages = false) {
  state.sessionId = createSessionId();
  state.history = [];
  state.lastAudioBase64 = "";
  if (clearMessages) {
    state.messages = [];
  }
  hideSlotPicker();
  persistState();
  updateSessionUI();
  renderMessages();
  syncStatus("Fresh session created", "ready");
}

function autoResizeTextarea() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${elements.messageInput.scrollHeight}px`;
}

function hideSlotPicker() {
  elements.slotPickerPanel.classList.add("hidden");
  elements.slotPickerPanel.innerHTML = "";
}

function summarizeResponseBody(rawText) {
  if (!rawText) return "The workflow returned an empty response body.";

  const cleaned = rawText
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "The workflow returned a non-text response body.";
  }

  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

async function readResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (!rawText) {
    return { data: {}, rawText, contentType };
  }

  const looksLikeJson =
    contentType.includes("application/json") || contentType.includes("+json");

  if (looksLikeJson) {
    try {
      return { data: JSON.parse(rawText), rawText, contentType };
    } catch (error) {
      throw new Error(
        `The workflow returned invalid JSON. ${summarizeResponseBody(rawText)}`,
      );
    }
  }

  try {
    return { data: JSON.parse(rawText), rawText, contentType };
  } catch {
    return {
      data: {
        message: summarizeResponseBody(rawText),
      },
      rawText,
      contentType,
    };
  }
}

function showSlotPicker(slotPicker) {
  if (!slotPicker || !Array.isArray(slotPicker.slots) || slotPicker.slots.length === 0) {
    hideSlotPicker();
    return;
  }

  const heading = slotPicker.is_reschedule
    ? "Choose a new appointment time"
    : "Available appointment times";

  const intro = slotPicker.is_reschedule
    ? `Reschedule with Dr ${slotPicker.doctor_name} on ${slotPicker.date}.`
    : `Select a time with Dr ${slotPicker.doctor_name} on ${slotPicker.date}.`;

  const slotButtons = slotPicker.slots
    .map(
      (slot) =>
        `<button class="slot-btn" type="button" data-slot="${slot}">${slot}</button>`,
    )
    .join("");

  elements.slotPickerPanel.innerHTML = `
    <h3>${heading}</h3>
    <p>${intro}</p>
    <div class="slot-grid">${slotButtons}</div>
  `;

  elements.slotPickerPanel.classList.remove("hidden");
  elements.slotPickerPanel.querySelectorAll(".slot-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.slot;
      elements.messageInput.value = slotPicker.is_reschedule
        ? `Move it to ${selected}`
        : `Book ${selected}`;
      autoResizeTextarea();
      elements.messageInput.focus();
    });
  });
}

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || state.sending) return;

  state.webhookUrl = elements.webhookUrl.value.trim() || DEFAULT_WEBHOOK;
  persistState();
  updateSessionUI();

  addMessage({ role: "user", text: trimmed });
  elements.messageInput.value = "";
  autoResizeTextarea();
  setComposerState(true);
  syncStatus("Contacting live workflow...", "busy");
  hideSlotPicker();

  try {
    const response = await fetch(state.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: trimmed,
        session_id: state.sessionId,
        history: state.history,
      }),
    });

    const { data, rawText } = await readResponsePayload(response);

    const responseMessage = data.message || summarizeResponseBody(rawText);

    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText || "Request failed"}: ${responseMessage}`,
      );
    }

    if (data.success === false) {
      throw new Error(responseMessage || "The workflow reported a failure.");
    }

    state.history = Array.isArray(data.history) ? data.history : state.history;
    state.lastAudioBase64 = data.audio || "";
    persistState();

    addMessage({
      role: "assistant",
      text: data.text || "The workflow responded without any message text.",
    });

    showSlotPicker(data.slot_picker);
    updateSessionUI();
    syncStatus("Live workflow responded successfully", "ready");
  } catch (error) {
    addMessage({
      role: "system",
      text: `Request failed: ${error.message}`,
    });
    syncStatus("Request failed", "error");
  } finally {
    setComposerState(false);
  }
}

function playLastAudio() {
  if (!state.lastAudioBase64) return;

  const audio = new Audio(`data:audio/mpeg;base64,${state.lastAudioBase64}`);
  audio.play().catch(() => {
    addMessage({
      role: "system",
      text: "Audio playback was blocked by the browser. Try clicking play again.",
    });
  });
}

elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(elements.messageInput.value);
});

elements.messageInput.addEventListener("input", autoResizeTextarea);

elements.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.chatForm.requestSubmit();
  }
});

elements.promptGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".prompt-chip");
  if (!button) return;
  elements.messageInput.value = button.dataset.prompt || "";
  autoResizeTextarea();
  elements.messageInput.focus();
});

elements.newSessionBtn.addEventListener("click", () => resetSession(true));
elements.clearChatBtn.addEventListener("click", () => {
  state.messages = [];
  persistState();
  renderMessages();
  syncStatus("Chat cleared", "ready");
});

elements.playLastAudioBtn.addEventListener("click", playLastAudio);

elements.webhookUrl.addEventListener("change", () => {
  state.webhookUrl = elements.webhookUrl.value.trim() || DEFAULT_WEBHOOK;
  persistState();
  syncStatus("Webhook updated", "ready");
});

restoreState();
updateSessionUI();
renderMessages();
autoResizeTextarea();
