// ---- Modal & Etapas ----
const modalOverlay = document.getElementById("modal-overlay");
const stepEls = document.querySelectorAll(".mm-step");
const tabPanels = document.querySelectorAll(".tab-panel");

const STEP_ORDER = ["story-tab", "lyrics-tab", "music-tab", "payment-tab"];

function openModal() {
  modalOverlay.hidden = false;
}

function closeModal() {
  modalOverlay.hidden = true;
}

document.getElementById("start-btn").addEventListener("click", openModal);
document.getElementById("modal-close-btn").addEventListener("click", closeModal);

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
    lyricsStepSubtitle.textContent = "Preencha as informações abaixo e o ChatGPT escreve a letra pra você.";
  }
  goToStep("lyrics-tab");
});

document.getElementById("own-lyrics-continue-btn").addEventListener("click", () => {
  const ownLyrics = document.getElementById("own-lyrics-input").value.trim();
  if (!ownLyrics) return;

  document.getElementById("lyrics").value = ownLyrics;
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
setupChipGrid("mood-chip-grid", "lyrics-mood");

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

lyricsForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const theme = document.getElementById("lyrics-theme").value.trim();
  const genre = document.getElementById("lyrics-genre").value.trim();
  const mood = document.getElementById("lyrics-mood").value.trim();
  const extra = document.getElementById("lyrics-extra").value.trim();

  if (!theme || !genre || !mood) return;

  lyricsBtn.disabled = true;
  lyricsResult.hidden = true;
  setLyricsStatus("Escrevendo sua letra...");

  try {
    const res = await fetch("/api/lyrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, genre, mood, extra }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Erro ao gerar a letra.");
    }

    lyricsOutput.value = data.lyrics;
    lyricsResult.hidden = false;
    setLyricsStatus("");
  } catch (err) {
    setLyricsStatus(err.message, true);
  } finally {
    lyricsBtn.disabled = false;
  }
});

copyLyricsBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(lyricsOutput.value);
  copyLyricsBtn.textContent = "Copiado!";
  setTimeout(() => (copyLyricsBtn.textContent = "Copiar"), 1500);
});

useLyricsBtn.addEventListener("click", () => {
  const genre = document.getElementById("lyrics-genre").value.trim();
  const mood = document.getElementById("lyrics-mood").value.trim();

  document.getElementById("prompt").value = `${genre}, clima ${mood}`;
  document.getElementById("lyrics").value = lyricsOutput.value;

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
const downloadLink = document.getElementById("download-link");

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

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const prompt = promptInput.value.trim();
  const lyrics = lyricsInput.value.trim();
  if (!prompt || lyrics.length < 10) {
    setStatus("Preencha o estilo e uma letra com pelo menos 10 caracteres.", true);
    return;
  }

  const fullPrompt = `${prompt}, voz ${voiceGenderInput.value}`;

  generateBtn.disabled = true;
  resultEl.hidden = true;
  setStatus("Gerando sua prévia... isso pode levar de 30s a alguns minutos.");

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: fullPrompt, lyrics }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Erro ao gerar a música.");
    }

    audioPlayer.src = data.audioUrl;
    downloadLink.href = data.audioUrl;
    resultEl.hidden = false;
    setStatus("");
    lastGeneration = { prompt: fullPrompt, lyrics };
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    generateBtn.disabled = false;
  }
});

document.getElementById("continue-payment-btn").addEventListener("click", () => {
  goToStep("payment-tab");
});

// ---- Etapa 4: Pagamento (Pix inline) ----
const pixForm = document.getElementById("pix-form");
const pixEmailInput = document.getElementById("pix-email");
const checkoutBtn = document.getElementById("checkout-btn");
const checkoutStatus = document.getElementById("checkout-status");
const pixResult = document.getElementById("pix-result");
const pixQrImage = document.getElementById("pix-qr-image");
const pixCopyPaste = document.getElementById("pix-copy-paste");
const copyPixBtn = document.getElementById("copy-pix-btn");
const fullSongResult = document.getElementById("full-song-result");
const fullAudioPlayer = document.getElementById("full-audio-player");
const fullDownloadLink = document.getElementById("full-download-link");

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

  checkoutBtn.disabled = true;
  pixResult.hidden = true;
  fullSongResult.hidden = true;
  if (pollTimer) clearInterval(pollTimer);
  setCheckoutStatus("Gerando seu Pix...");

  try {
    const res = await fetch("/api/pix-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Erro ao gerar o Pix.");
    }

    pixQrImage.src = `data:image/png;base64,${data.qrCodeBase64}`;
    pixCopyPaste.value = data.qrCode;
    pixResult.hidden = false;
    setCheckoutStatus("Escaneie o QR Code ou copie o código Pix. Aguardando pagamento...");

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
      setCheckoutStatus("Pagamento confirmado! Gerando sua música completa...");
      await generateFullSong();
    }
  } catch (err) {
    // ignora falhas pontuais do polling
  }
}

async function generateFullSong() {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: lastGeneration.prompt, lyrics: lastGeneration.lyrics, full: true }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Erro ao gerar a música completa.");
    }

    fullAudioPlayer.src = data.audioUrl;
    fullDownloadLink.href = data.audioUrl;
    fullSongResult.hidden = false;
    pixResult.hidden = true;
    setCheckoutStatus("");
  } catch (err) {
    setCheckoutStatus(err.message, true);
  }
}
