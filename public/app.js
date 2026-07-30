// ---- Meta Pixel ----
function trackPixel(event, params) {
  if (typeof fbq === "function") fbq("track", event, params);
}

// ---- Modal & Etapas ----
const modalOverlay = document.getElementById("modal-overlay");
const stepEls = document.querySelectorAll(".mm-step");
const tabPanels = document.querySelectorAll(".tab-panel");

const STEP_ORDER = ["story-tab", "lyrics-tab", "music-tab", "payment-tab"];

function openModal() {
  modalOverlay.hidden = false;
  trackPixel("Lead");
}

function closeModal() {
  modalOverlay.hidden = true;
}

document.getElementById("start-btn").addEventListener("click", openModal);
document.getElementById("modal-close-btn").addEventListener("click", closeModal);

document.querySelectorAll(".back-link").forEach((btn) => {
  btn.addEventListener("click", () => goToStep(btn.dataset.back));
});

function goToStep(tabId) {
  const stepIndex = STEP_ORDER.indexOf(tabId);

  tabPanels.forEach((p) => p.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");

  stepEls.forEach((el) => {
    const n = Number(el.dataset.step) - 1;
    el.classList.remove("is-active", "is-done");
    if (n < stepIndex) el.classList.add("is-done");
    else if (n === stepIndex) el.classList.add("is-active");
  });

  modalOverlay.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- Etapa 1: História ----
const optionCards = document.querySelectorAll(".option-card");
const lyricsForm = document.getElementById("lyrics-form");
const ownLyricsBlock = document.getElementById("own-lyrics-block");
const lyricsStepTitle = document.getElementById("lyrics-step-title");
const lyricsStepSubtitle = document.getElementById("lyrics-step-subtitle");

let storyMode = "ai";

optionCards.forEach((card) => {
  card.addEventListener("click", () => {
    optionCards.forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    storyMode = card.dataset.mode;
  });
});

document.getElementById("story-continue-btn").addEventListener("click", () => {
  if (storyMode === "own") {
    lyricsForm.hidden = true;
    ownLyricsBlock.hidden = false;
    lyricsStepTitle.textContent = "Cole a letra que você já tem";
    lyricsStepSubtitle.textContent = "Vamos transformar essa letra em uma música completa.";
  } else {
    lyricsForm.hidden = false;
    ownLyricsBlock.hidden = true;
    lyricsStepTitle.textContent = "Vamos escrever a letra";
    lyricsStepSubtitle.textContent = "Preencha as informações abaixo e a IA escreve a letra pra você.";
    document.getElementById("lyrics-card-recipient").hidden = false;
    document.getElementById("lyrics-card-genre").hidden = true;
  }
  goToStep("lyrics-tab");
});

document.getElementById("own-lyrics-continue-btn").addEventListener("click", () => {
  const ownLyrics = document.getElementById("own-lyrics-input").value.trim();
  if (!ownLyrics) return;

  document.getElementById("lyrics").value = ownLyrics;
  document.getElementById("lyrics").readOnly = true;
  document.getElementById("lyrics-lock-hint").hidden = false;
  document.getElementById("prompt").readOnly = false;
  document.getElementById("prompt-lock-hint").hidden = true;
  goToStep("music-tab");
});

// ---- Chips: gênero e humor ----
function setupChipGrid(gridId, hiddenInputId, selectId) {
  const grid = document.getElementById(gridId);
  const hiddenInput = document.getElementById(hiddenInputId);
  const select = selectId ? document.getElementById(selectId) : null;
  const chips = grid.querySelectorAll(".chip");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      hiddenInput.value = chip.dataset.value;
      if (select) select.value = "";
    });
  });

  if (select) {
    select.addEventListener("change", () => {
      chips.forEach((c) => c.classList.remove("selected"));
      hiddenInput.value = select.value;
    });
  }
}

setupChipGrid("genre-chip-grid", "lyrics-genre", "lyrics-genre-select");
setupChipGrid("recipient-chip-grid", "lyrics-recipient", "lyrics-recipient-select");

// ---- Sub-etapas do card de letra: destinatário → gênero/história ----
const lyricsCardRecipient = document.getElementById("lyrics-card-recipient");
const lyricsCardGenre = document.getElementById("lyrics-card-genre");

document.getElementById("recipient-continue-btn").addEventListener("click", () => {
  const recipient = document.getElementById("lyrics-recipient").value.trim();
  if (!recipient) {
    setLyricsStatus("Escolha para quem é a música antes de continuar.", true);
    return;
  }

  setLyricsStatus("");
  lyricsCardRecipient.hidden = true;
  lyricsCardGenre.hidden = false;
});

document.getElementById("recipient-back-btn").addEventListener("click", () => {
  setLyricsStatus("");
  lyricsCardGenre.hidden = true;
  lyricsCardRecipient.hidden = false;
});

// ---- Gerar Letra ----
const lyricsBtn = document.getElementById("lyrics-btn");
const lyricsStatus = document.getElementById("lyrics-status");
const lyricsResult = document.getElementById("lyrics-result");
const lyricsOutput = document.getElementById("lyrics-output");
const copyLyricsBtn = document.getElementById("copy-lyrics-btn");
const useLyricsBtn = document.getElementById("use-lyrics-btn");

function setLyricsStatus(message, isError = false) {
  lyricsStatus.hidden = !message;
  lyricsStatus.textContent = message;
  lyricsStatus.classList.toggle("error", isError);
}

// ---- Limite de gerações (letra e prévia) ----
const MAX_LYRICS_GENERATIONS = 3;
const MAX_MUSIC_GENERATIONS = 1;
const lyricsGenerationCounter = document.getElementById("lyrics-generation-counter");
const musicGenerationCounter = document.getElementById("music-generation-counter");
let lyricsGenerationCount = 0;
let musicGenerationCount = 0;

// ---- Persistência dos limites (sobrevive a reload/fechar a página) ----
const GENERATION_COUNTS_KEY = "generationCounts";

function saveGenerationCounts() {
  try {
    localStorage.setItem(
      GENERATION_COUNTS_KEY,
      JSON.stringify({ lyrics: lyricsGenerationCount, music: musicGenerationCount })
    );
  } catch (err) {
    // localStorage indisponível (modo privado etc.) — segue sem persistir
  }
}

function loadGenerationCounts() {
  try {
    const raw = localStorage.getItem(GENERATION_COUNTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function clearGenerationCounts() {
  try {
    localStorage.removeItem(GENERATION_COUNTS_KEY);
  } catch (err) {
    // ignora
  }
}

function renderLyricsGenerationUI() {
  if (lyricsGenerationCount <= 0) return;

  lyricsGenerationCounter.hidden = false;

  if (lyricsGenerationCount >= MAX_LYRICS_GENERATIONS) {
    lyricsBtn.disabled = true;
    lyricsBtn.textContent = "Limite de gerações atingido";
    lyricsGenerationCounter.classList.add("limit-reached");
    lyricsGenerationCounter.textContent = `Limite de ${MAX_LYRICS_GENERATIONS} gerações de letra atingido.`;
  } else {
    lyricsGenerationCounter.textContent = `Versões geradas: ${lyricsGenerationCount} de ${MAX_LYRICS_GENERATIONS}`;
  }
}

function renderMusicGenerationUI() {
  if (musicGenerationCount <= 0) return;

  musicGenerationCounter.hidden = false;

  if (musicGenerationCount >= MAX_MUSIC_GENERATIONS) {
    generateBtn.disabled = true;
    generateBtn.textContent = "Limite de gerações atingido";
    musicGenerationCounter.classList.add("limit-reached");
    const previewWord = MAX_MUSIC_GENERATIONS === 1 ? "prévia" : "prévias";
    musicGenerationCounter.textContent = `Limite de ${MAX_MUSIC_GENERATIONS} ${previewWord} atingido. Finalize o pagamento para continuar.`;
  } else {
    musicGenerationCounter.textContent = `Versões geradas: ${musicGenerationCount} de ${MAX_MUSIC_GENERATIONS}`;
  }
}

function registerLyricsGeneration() {
  lyricsGenerationCount += 1;
  saveGenerationCounts();
  renderLyricsGenerationUI();
}

function registerMusicGeneration() {
  musicGenerationCount += 1;
  saveGenerationCounts();
  renderMusicGenerationUI();
}

lyricsForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (lyricsGenerationCount >= MAX_LYRICS_GENERATIONS) return;

  const recipient = document.getElementById("lyrics-recipient").value.trim();
  const recipientName = document.getElementById("lyrics-recipient-name").value.trim();
  const genre = document.getElementById("lyrics-genre").value.trim();
  const extra = document.getElementById("lyrics-extra").value.trim();

  if (!recipient || !genre) return;

  if (extra.length < 20) {
    setLyricsStatus("Conte um pouco mais sobre a história (mínimo 20 caracteres).", true);
    return;
  }

  const theme = recipientName
    ? `Uma homenagem para ${recipient.toLowerCase()}, chamada(o) ${recipientName}`
    : `Uma homenagem para ${recipient.toLowerCase()}`;

  lyricsBtn.disabled = true;
  lyricsResult.hidden = true;
  setLyricsStatus("Escrevendo sua letra...");

  try {
    const res = await fetch("/api/lyrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, genre, extra }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Erro ao gerar a letra.");
    }

    lyricsOutput.value = data.lyrics;
    lyricsResult.hidden = false;
    setLyricsStatus("");
    registerLyricsGeneration();
  } catch (err) {
    setLyricsStatus(err.message, true);
  } finally {
    if (lyricsGenerationCount < MAX_LYRICS_GENERATIONS) lyricsBtn.disabled = false;
  }
});

copyLyricsBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(lyricsOutput.value);
  copyLyricsBtn.textContent = "Copiado!";
  setTimeout(() => (copyLyricsBtn.textContent = "Copiar"), 1500);
});

useLyricsBtn.addEventListener("click", () => {
  const genre = document.getElementById("lyrics-genre").value.trim();

  document.getElementById("prompt").value = genre;
  document.getElementById("prompt").readOnly = true;
  document.getElementById("prompt-lock-hint").hidden = false;
  document.getElementById("lyrics").value = lyricsOutput.value;
  document.getElementById("lyrics").readOnly = true;
  document.getElementById("lyrics-lock-hint").hidden = false;

  goToStep("music-tab");
});

// ---- Gerar Música ----
const form = document.getElementById("generate-form");
const promptInput = document.getElementById("prompt");
const lyricsInput = document.getElementById("lyrics");
const voiceButtons = document.querySelectorAll(".voice-btn");
const voiceGenderInput = document.getElementById("voice-gender");
const generateBtn = document.getElementById("generate-btn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const audioPlayer = document.getElementById("audio-player");

voiceButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    voiceButtons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    voiceGenderInput.value = btn.dataset.voice;
  });
});

function setStatus(message, isError = false) {
  statusEl.hidden = !message;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

let lastGeneration = null;

// ---- Continuar de onde parou (prévia não paga) ----
const PENDING_SONG_KEY = "pendingSong";

function savePendingSong() {
  try {
    localStorage.setItem(PENDING_SONG_KEY, JSON.stringify(lastGeneration));
  } catch (err) {
    // localStorage indisponível (modo privado etc.) — segue sem persistir
  }
}

function clearPendingSong() {
  try {
    localStorage.removeItem(PENDING_SONG_KEY);
  } catch (err) {
    // ignora
  }
}

function loadPendingSong() {
  try {
    const raw = localStorage.getItem(PENDING_SONG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

// ---- Card "compondo" (cronômetro, barra de progresso, mensagens) ----
const generatingCard = document.getElementById("generating-card");
const countdownValue = document.getElementById("countdown-value");
const progressFill = document.getElementById("progress-fill");
const generatingStatus = document.getElementById("generating-status");

const GENERATING_MESSAGES = [
  "Preparando a voz da canção...",
  "Compondo a melodia...",
  "Ajustando a harmonia entre voz e instrumentos...",
  "Sincronizando a voz com cada trecho da letra...",
  "Afinando os últimos detalhes...",
];

const ESTIMATED_SECONDS = 100;
let generatingTimer = null;
let generatingElapsed = 0;

function formatCountdown(seconds) {
  const s = Math.max(seconds, 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function startGeneratingCard() {
  generatingElapsed = 0;
  generatingCard.hidden = false;
  countdownValue.textContent = formatCountdown(ESTIMATED_SECONDS);
  progressFill.style.width = "0%";
  generatingStatus.textContent = GENERATING_MESSAGES[0];

  generatingCard.scrollIntoView({ behavior: "smooth", block: "center" });

  generatingTimer = setInterval(() => {
    generatingElapsed += 1;

    const remaining = ESTIMATED_SECONDS - generatingElapsed;
    countdownValue.textContent =
      remaining > 0 ? formatCountdown(remaining) : "quase lá...";

    const progressPct = Math.min((generatingElapsed / ESTIMATED_SECONDS) * 100, 96);
    progressFill.style.width = `${progressPct}%`;

    const msgIndex = Math.min(
      Math.floor(generatingElapsed / 20),
      GENERATING_MESSAGES.length - 1
    );
    generatingStatus.textContent = GENERATING_MESSAGES[msgIndex];
  }, 1000);
}

function stopGeneratingCard() {
  clearInterval(generatingTimer);
  generatingCard.hidden = true;
}

const PREVIEW_SECONDS = 40;

// ---- Player customizado (usado na prévia e na música completa) ----
function setupCustomPlayer(audioEl, toggleBtn, trackEl, fillEl, timeEl) {
  let capSeconds = null;
  const playerEl = toggleBtn.closest(".player");
  const thumbEl = trackEl.querySelector(".player-thumb");

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const r = total % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function effectiveDuration() {
    return capSeconds ?? (audioEl.duration || 0);
  }

  function updateUI() {
    const duration = effectiveDuration();
    const current = Math.min(audioEl.currentTime, duration || audioEl.currentTime);
    const pct = duration ? (current / duration) * 100 : 0;
    fillEl.style.width = `${pct}%`;
    if (thumbEl) thumbEl.style.left = `${pct}%`;
    timeEl.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  }

  toggleBtn.addEventListener("click", () => {
    if (audioEl.paused) audioEl.play();
    else audioEl.pause();
  });

  audioEl.addEventListener("play", () => {
    toggleBtn.textContent = "⏸";
    if (playerEl) playerEl.classList.add("is-playing");
  });
  audioEl.addEventListener("pause", () => {
    toggleBtn.textContent = "▶";
    if (playerEl) playerEl.classList.remove("is-playing");
  });
  audioEl.addEventListener("ended", () => {
    toggleBtn.textContent = "▶";
    if (playerEl) playerEl.classList.remove("is-playing");
  });

  audioEl.addEventListener("timeupdate", () => {
    if (capSeconds && audioEl.currentTime >= capSeconds) {
      audioEl.pause();
      audioEl.currentTime = capSeconds;
    }
    updateUI();
  });

  audioEl.addEventListener("loadedmetadata", updateUI);

  trackEl.addEventListener("click", (e) => {
    const rect = trackEl.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const duration = effectiveDuration();
    if (duration) audioEl.currentTime = ratio * duration;
  });

  return {
    setCap(seconds) {
      capSeconds = seconds;
      audioEl.pause();
      audioEl.currentTime = 0;
      toggleBtn.textContent = "▶";
      updateUI();
    },
  };
}

const previewPlayer = setupCustomPlayer(
  audioPlayer,
  document.getElementById("player-toggle"),
  document.getElementById("player-track"),
  document.getElementById("player-fill"),
  document.getElementById("player-time")
);

let musicPollTimer = null;

function finishMusicGeneration() {
  stopGeneratingCard();
  if (musicGenerationCount < MAX_MUSIC_GENERATIONS) generateBtn.disabled = false;
}

function pollMusicGeneration(taskId, prompt, lyrics) {
  if (musicPollTimer) clearInterval(musicPollTimer);

  async function check() {
    try {
      const res = await fetch(`/api/generate/status/${taskId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao gerar a música.");

      if (data.done) {
        clearInterval(musicPollTimer);
        musicPollTimer = null;

        audioPlayer.src = data.audioUrl;
        previewPlayer.setCap(PREVIEW_SECONDS);
        resultEl.hidden = false;
        setStatus("");
        lastGeneration = { prompt, lyrics, audioUrl: data.audioUrl };
        savePendingSong();
        registerMusicGeneration();
        finishMusicGeneration();
      }
    } catch (err) {
      clearInterval(musicPollTimer);
      musicPollTimer = null;
      setStatus(err.message, true);
      finishMusicGeneration();
    }
  }

  musicPollTimer = setInterval(check, 5000);

  // Se a pessoa voltar pro app depois de um tempo em segundo plano,
  // confere o status na hora em vez de esperar o próximo intervalo.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && musicPollTimer) check();
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (musicGenerationCount >= MAX_MUSIC_GENERATIONS) return;

  const prompt = promptInput.value.trim();
  const lyrics = lyricsInput.value.trim();
  if (!prompt || lyrics.length < 10) {
    setStatus("Preencha o estilo e uma letra com pelo menos 10 caracteres.", true);
    return;
  }

  generateBtn.disabled = true;
  resultEl.hidden = true;
  setStatus("");
  startGeneratingCard();

  try {
    const res = await fetch("/api/generate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, lyrics, voiceGender: voiceGenderInput.value }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Erro ao iniciar a geração da música.");
    }

    pollMusicGeneration(data.taskId, prompt, lyrics);
  } catch (err) {
    setStatus(err.message, true);
    finishMusicGeneration();
  }
});

let secondSongPrepaid = false;

document.getElementById("continue-payment-btn").addEventListener("click", () => {
  goToStep("payment-tab");

  if (secondSongPrepaid) {
    secondSongPrepaid = false;
    unlockPaidSong();
  }
});

document.getElementById("create-second-song-btn").addEventListener("click", () => {
  secondSongPrepaid = true;

  lyricsGenerationCount = 0;
  musicGenerationCount = 0;
  clearGenerationCounts();
  lyricsBtn.disabled = false;
  lyricsBtn.textContent = "Gerar Letra →";
  generateBtn.disabled = false;
  generateBtn.textContent = "Gerar Prévia →";
  lyricsGenerationCounter.hidden = true;
  lyricsGenerationCounter.classList.remove("limit-reached");
  musicGenerationCounter.hidden = true;
  musicGenerationCounter.classList.remove("limit-reached");

  document.getElementById("lyrics-recipient").value = "";
  document.getElementById("lyrics-recipient-select").value = "";
  document.getElementById("lyrics-recipient-name").value = "";
  document.querySelectorAll("#recipient-chip-grid .chip").forEach((c) => c.classList.remove("selected"));
  document.getElementById("lyrics-card-recipient").hidden = false;
  document.getElementById("lyrics-card-genre").hidden = true;
  document.getElementById("lyrics-extra").value = "";
  promptInput.value = "";
  promptInput.readOnly = false;
  document.getElementById("prompt-lock-hint").hidden = true;
  lyricsInput.value = "";
  lyricsInput.readOnly = false;
  document.getElementById("lyrics-lock-hint").hidden = true;
  lyricsResult.hidden = true;
  resultEl.hidden = true;

  document.getElementById("checkout-block").hidden = false;
  document.getElementById("payment-back-link").hidden = false;
  document.getElementById("success-banner").hidden = true;
  document.getElementById("bundle-checkbox").checked = false;
  updateOrderTotal();
  fullSongResult.hidden = true;
  document.getElementById("create-second-song-btn").hidden = true;

  goToStep("story-tab");
});

// ---- Etapa 4: Pagamento (Pix inline) ----
const pixForm = document.getElementById("pix-form");
const pixEmailInput = document.getElementById("pix-email");
const pixPhoneInput = document.getElementById("pix-phone");
const checkoutBtn = document.getElementById("checkout-btn");
const checkoutStatus = document.getElementById("checkout-status");
const pixResult = document.getElementById("pix-result");
const pixQrImage = document.getElementById("pix-qr-image");
const pixCopyPaste = document.getElementById("pix-copy-paste");
const copyPixBtn = document.getElementById("copy-pix-btn");
const simulatePaymentBtn = document.getElementById("simulate-payment-btn");

simulatePaymentBtn.addEventListener("click", () => {
  if (pollTimer) clearInterval(pollTimer);
  unlockPaidSong();
});
const fullSongResult = document.getElementById("full-song-result");
const fullAudioPlayer = document.getElementById("full-audio-player");
const fullDownloadLink = document.getElementById("full-download-link");
const shareWhatsappBtn = document.getElementById("share-whatsapp-btn");

shareWhatsappBtn.addEventListener("click", () => {
  if (!lastGeneration?.audioUrl) return;

  const shareText = "Ouça a música que eu criei com a Minha Música IA! 🎵";

  if (navigator.share) {
    navigator.share({ title: "Minha Música IA", text: shareText, url: lastGeneration.audioUrl }).catch(() => {});
    return;
  }

  const waText = `${shareText} ${lastGeneration.audioUrl}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, "_blank");
});

// ---- Upsell: 2 músicas por R$ 50,00 ----
const bundleCheckbox = document.getElementById("bundle-checkbox");
const orderTotalValue = document.getElementById("order-total-value");
const checkoutBtnValue = document.getElementById("checkout-btn-value");
let lastPaidAsBundle = false;

function updateOrderTotal() {
  const price = bundleCheckbox.checked ? "R$ 50,00" : "R$ 29,90";
  orderTotalValue.textContent = price;
  checkoutBtnValue.textContent = price;
}

bundleCheckbox.addEventListener("change", updateOrderTotal);

const fullPlayer = setupCustomPlayer(
  fullAudioPlayer,
  document.getElementById("full-player-toggle"),
  document.getElementById("full-player-track"),
  document.getElementById("full-player-fill"),
  document.getElementById("full-player-time")
);

let pollTimer = null;

function setCheckoutStatus(message, isError = false) {
  checkoutStatus.hidden = !message;
  checkoutStatus.textContent = message;
  checkoutStatus.classList.toggle("error", isError);
}

pixForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!lastGeneration) {
    setCheckoutStatus("Gere uma prévia antes de continuar para o pagamento.", true);
    return;
  }

  const email = pixEmailInput.value.trim();
  if (!email) return;
  const phone = pixPhoneInput.value.trim();

  lastPaidAsBundle = bundleCheckbox.checked;

  checkoutBtn.disabled = true;
  pixResult.hidden = true;
  fullSongResult.hidden = true;
  document.getElementById("checkout-block").hidden = false;
  document.getElementById("payment-back-link").hidden = false;
  document.getElementById("success-banner").hidden = true;
  if (pollTimer) clearInterval(pollTimer);
  setCheckoutStatus("Gerando seu Pix...");

  try {
    const res = await fetch("/api/pix-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, bundle: lastPaidAsBundle }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Erro ao gerar o Pix.");
    }

    pixQrImage.src = `data:image/png;base64,${data.qrCodeBase64}`;
    pixCopyPaste.value = data.qrCode;
    pixResult.hidden = false;
    setCheckoutStatus("Escaneie o QR Code ou copie o código Pix. Aguardando pagamento...");
    trackPixel("InitiateCheckout", { value: 29.9, currency: "BRL" });

    const isTestMode =
      window.location.hostname === "localhost" ||
      new URLSearchParams(window.location.search).has("test");
    simulatePaymentBtn.hidden = !isTestMode;

    pollTimer = setInterval(() => checkPixStatus(data.paymentId), 4000);
  } catch (err) {
    setCheckoutStatus(err.message, true);
  } finally {
    checkoutBtn.disabled = false;
  }
});

copyPixBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(pixCopyPaste.value);
  copyPixBtn.textContent = "Copiado!";
  setTimeout(() => (copyPixBtn.textContent = "Copiar código Pix"), 1500);
});

async function checkPixStatus(paymentId) {
  try {
    const res = await fetch(`/api/pix-payment/${paymentId}/status`);
    const data = await res.json();

    if (!res.ok) return;

    if (data.status === "approved") {
      clearInterval(pollTimer);
      unlockPaidSong();
    }
  } catch (err) {
    // ignora falhas pontuais do polling
  }
}

function unlockPaidSong() {
  clearPendingSong();
  clearGenerationCounts();
  fullAudioPlayer.src = lastGeneration.audioUrl;
  fullPlayer.setCap(null);
  fullDownloadLink.href = lastGeneration.audioUrl;
  fullSongResult.hidden = false;
  pixResult.hidden = true;

  const deliveryEmailEl = document.getElementById("delivery-email");
  if (deliveryEmailEl) deliveryEmailEl.textContent = pixEmailInput.value.trim() || "seu e-mail";

  const deliveryWhatsappNote = document.getElementById("delivery-whatsapp-note");
  if (deliveryWhatsappNote) deliveryWhatsappNote.hidden = !pixPhoneInput.value.trim();

  document.getElementById("checkout-block").hidden = true;
  document.getElementById("payment-back-link").hidden = true;
  document.getElementById("success-banner").hidden = false;

  const createSecondSongBtn = document.getElementById("create-second-song-btn");
  if (lastPaidAsBundle) {
    createSecondSongBtn.hidden = false;
    setCheckoutStatus("Sua música está liberada abaixo — e você ainda tem +1 música garantida na promoção.");
  } else {
    createSecondSongBtn.hidden = true;
    setCheckoutStatus("Sua música completa está liberada abaixo e também foi enviada para o seu e-mail.");
  }
  lastPaidAsBundle = false;

  trackPixel("Purchase", { value: 29.9, currency: "BRL" });
  sendSongEmail();
}

async function sendSongEmail() {
  try {
    await fetch("/api/send-song-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pixEmailInput.value.trim(), audioUrl: lastGeneration.audioUrl }),
    });
  } catch (err) {
    // não bloqueia a experiência se o e-mail falhar
  }
}

// ---- Restaura prévia não paga ao recarregar a página ----
(function restorePendingSong() {
  const pending = loadPendingSong();
  if (!pending || !pending.audioUrl) return;

  lastGeneration = pending;
  promptInput.value = pending.prompt || "";
  lyricsInput.value = pending.lyrics || "";
  audioPlayer.src = pending.audioUrl;
  previewPlayer.setCap(PREVIEW_SECONDS);
  resultEl.hidden = false;

  openModal();
  goToStep("payment-tab");
  setCheckoutStatus("Continuando de onde você parou — finalize o pagamento para liberar sua música.");
})();

// ---- Restaura limites de geração ao recarregar a página ----
(function restoreGenerationCounts() {
  const counts = loadGenerationCounts();
  if (!counts) return;

  lyricsGenerationCount = counts.lyrics || 0;
  musicGenerationCount = counts.music || 0;
  renderLyricsGenerationUI();
  renderMusicGenerationUI();
})();
