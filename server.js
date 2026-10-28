
const express = require("express");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "1mb" }));

if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is missing from .env");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

let latestRobotAnswer = "IDLE";
const allowedLanguages = ["English", "Telugu", "Hindi"];

app.use(express.static(__dirname));

function getNameAnswer(question, language) {
  const q = question.toLowerCase();

  const asksName =
    /\b(your name|who are you|what are you called)\b/i.test(q) ||
    /నీ పేరేంటి|నీ పేరు ఏమిటి|మీ పేరేంటి|మీ పేరు ఏమిటి|నువ్వు ఎవరు|మీరు ఎవరు/.test(q) ||
    /तुम्हारा नाम क्या है|आपका नाम क्या है|तुम कौन हो|आप कौन हैं/.test(q);

  if (!asksName) return null;

  const answers = {
    English: "My name is Bujji! Nice to meet you!",
    Telugu: "నా పేరు బుజ్జి! మిమ్మల్ని కలవడం చాలా సంతోషంగా ఉంది!",
    Hindi: "मेरा नाम बुज्जी है! आपसे मिलकर बहुत खुशी हुई!"
  };

  return answers[language] || answers.English;
}

// AI answer
app.post("/ask", async (req, res) => {
  try {
    const { question, language = "English" } = req.body || {};

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Please ask a question." });
    }

    const lang = allowedLanguages.includes(language) ? language : "English";
    const nameAnswer = getNameAnswer(question, lang);

    if (nameAnswer) {
      latestRobotAnswer = nameAnswer.slice(0, 200);
      return res.json({ answer: nameAnswer });
    }

    const result = await ai.interactions.create({
      model: "gemini-3.8-flash",
     system_instruction:
  "You are Bujji, a cute, friendly talking robot. " +
  "Your name is ALWAYS Bujji. Never say your name is Gemini, Google, " +
  "or any other AI model. Never introduce yourself as Gemini. " +
  "If someone asks who you are, say: I am Bujji, your friendly robot! " +
  "Answer naturally in the language requested by the user. " +
  "Keep answers short, clear, and friendly.",
      input: `Answer naturally in ${lang}: ${question.trim()}`,
      generation_config: { max_output_tokens: 300 }
    });

    const answer =
      result.output_text?.trim() || "Sorry, I could not answer that.";

    latestRobotAnswer = answer.slice(0, 200);
    res.json({ answer });
  } catch (error) {
    console.error("BUJJI AI ERROR:", error);
    res.status(500).json({
      error: "Bujji could not generate an answer. Check the VS Code terminal."
    });
  }
});

// Speech generation
app.post("/speak", async (req, res) => {
  try {
    const { text, language = "English" } = req.body || {};

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "No text was provided." });
    }

    const lang = allowedLanguages.includes(language) ? language : "English";

    const result = await ai.interactions.create({
      model: "gemini-3.8-flash-tts",
      input: [
        {
          type: "user_input",
          content: [
            {
              type: "text",
              text: text.trim(),
              annotations: [{
                type: "speech_metadata",
                style: `Speak naturally in ${lang}, with a warm, friendly, child-like robot voice. Read the text in its original language; do not translate it.`
              }]
            }
          ]
        }
      ],
      response_format: { type: "audio" },
      generation_config: {
        speech_config: [{ voice: "Orus" }]
      }
    });

    const audio = result.output_audio?.data;

    if (!audio) {
      throw new Error("The speech API returned no audio data.");
    }

    res.json({ audio, mimeType: "audio/wav" });
  } catch (error) {
    console.error("BUJJI SPEECH ERROR:", error);
    res.status(500).json({
      error: `Speech generation failed: ${error.message || "Check the terminal."}`
    });
  }
});

// Test routes
app.get("/health", (req, res) => {
  res.json({ status: "Bujji server is running" });
});

app.get("/robot-answer", (req, res) => {
  res.json({ answer: latestRobotAnswer });
});

app.listen(PORT, () => {
  console.log(`Bujji server running at http://localhost:${PORT}/voice.html`);
});
