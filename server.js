require("dotenv").config();
const express = require("express");
const Replicate = require("replicate");
const OpenAI = require("openai");

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.REPLICATE_API_TOKEN) {
  console.warn(
    "Aviso: REPLICATE_API_TOKEN nao definido. Crie um arquivo .env baseado no .env.example."
  );
}

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "Aviso: OPENAI_API_KEY nao definido. A geracao de letras nao vai funcionar sem ele."
  );
}

if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  console.warn(
    "Aviso: MERCADOPAGO_ACCESS_TOKEN nao definido. A etapa de pagamento nao vai funcionar sem ele."
  );
}

const FULL_SONG_PRICE = 29.9;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());
app.use(express.static("public"));

function truncateLyricsForPreview(lyrics, maxChars = 400) {
  const trimmed = lyrics.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const cut = trimmed.slice(0, maxChars);
  const lastNewline = cut.lastIndexOf("\n");
  return (lastNewline > 50 ? cut.slice(0, lastNewline) : cut).trim();
}

app.post("/api/generate", async (req, res) => {
  const { prompt, lyrics, full } = req.body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Descreva o estilo da musica que voce quer gerar." });
  }

  if (!lyrics || typeof lyrics !== "string" || lyrics.trim().length < 10) {
    return res.status(400).json({ error: "Adicione uma letra (pelo menos 10 caracteres) para gerar a prévia cantada." });
  }

  const previewLyrics = truncateLyricsForPreview(lyrics, full ? 600 : 400);

  try {
    const output = await replicate.run(
      "minimax/music-1.5:70c8395540eae909be2c09a0b4897d22ee2455a5e5c9826b71161743b5cc45f1",
      {
        input: {
          prompt: prompt.trim().slice(0, 300),
          lyrics: previewLyrics,
        },
      }
    );

    const audioUrl = Array.isArray(output) ? output[0] : output;
    res.json({ audioUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao gerar a musica. Verifique sua API key e tente novamente." });
  }
});

app.post("/api/pix-payment", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Informe um e-mail válido para gerar o Pix." });
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Pagamento não configurado. Defina MERCADOPAGO_ACCESS_TOKEN no .env." });
  }

  try {
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        "X-Idempotency-Key": `pix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      body: JSON.stringify({
        transaction_amount: FULL_SONG_PRICE,
        description: "Música personalizada - versão completa",
        payment_method_id: "pix",
        payer: { email },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return res.status(500).json({ error: "Falha ao gerar o Pix." });
    }

    const transactionData = data.point_of_interaction?.transaction_data;

    res.json({
      paymentId: data.id,
      qrCode: transactionData?.qr_code,
      qrCodeBase64: transactionData?.qr_code_base64,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao gerar o Pix." });
  }
});

app.get("/api/pix-payment/:id/status", async (req, res) => {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Pagamento não configurado." });
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${req.params.id}`, {
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return res.status(500).json({ error: "Falha ao checar o pagamento." });
    }

    res.json({ status: data.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao checar o pagamento." });
  }
});

app.post("/api/lyrics", async (req, res) => {
  const { theme, genre, mood, extra } = req.body;

  if (!theme || !genre || !mood) {
    return res.status(400).json({ error: "Preencha tema, gênero e humor para gerar a letra." });
  }

  const userPrompt = [
    `Tema/assunto: ${theme}`,
    `Gênero musical: ${genre}`,
    `Humor/emoção: ${mood}`,
    extra ? `Detalhes adicionais: ${extra}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você é um compositor profissional. Escreva letras de música originais em português, seguindo o tema, gênero e humor pedidos pelo usuário. Estruture a letra usando exatamente as tags [intro], [verse], [chorus], [bridge] e [outro] (em inglês, minúsculas, entre colchetes) antes de cada trecho correspondente, pois esse é o formato exigido pelo sintetizador de voz. O conteúdo das letras deve ser em português. Responda apenas com a letra, sem explicações nem markdown.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const lyrics = completion.choices[0]?.message?.content?.trim();
    res.json({ lyrics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao gerar a letra. Verifique sua API key e tente novamente." });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
