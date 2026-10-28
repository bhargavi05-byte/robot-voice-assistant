
const express = require("express");
const path = require("path");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// Check Gemini API key
if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is missing.");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

let latestRobotAnswer = "IDLE";

const allowedLanguages = ["English", "Telugu", "Hindi"];

// Serve static files such as HTML, CSS, JavaScript and images
app.use(express.static(__dirname));

// FIX: Open voice.html when a visitor opens the main website URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "voice.html"));
});

// Answer name-related questions directly
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

// AI answer endpoint
app.post("/ask", async (req, res) => {
  try {
    const { question, language = "English" } = req.body || {};

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        error: "Please ask a question."
      });
    }

    const lang = allowedLanguages.includes(language)
      ? language
      : "English";

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
      generation_config: {
        max_output_tokens: 300
      }
    });

    const answer =
      result.output_text?.trim() ||
      "Sorry, I could not answer that.";

    latestRobotAnswer = answer.slice(0, 200);

    return res.json({ answer });
  } catch (error) {
    console.error("BUJJI AI ERROR:", error);

    return res.status(500).json({
      error: "Bujji could not generate an answer. Check the server logs."
    });
  }
});

// Speech generation endpoint
app.post("/speak", async (req, res) => {
  try {
    const { text, language = "English" } = req.body || {};

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: "No text was provided."
      });
    }

    const lang = allowedLanguages.includes(language)
      ? language
      : "English";

    const result = await ai.interactions.create({
      model: "gemini-3.8-flash-tts",
      input: [
        {
          type: "user_input",
          content: [
            {
              type: "text",
              text: text.trim(),
              annotations: [
                {
                  type: "speech_metadata",
                  style:
                    `Speak naturally in ${lang}, with a warm, friendly, ` +
                    "child-like robot voice. Read the text in its original " +
                    "language; do not translate it."
                }
              ]
            }
          ]
        }
      ],
      response_format: {
        type: "audio"
      },
      generation_config: {
        speech_config: [
          {
            voice: "Orus"
          }
        ]
      }
    });

    const audio = result.output_audio?.data;

    if (!audio) {
      throw new Error("The speech API returned no audio data.");
    }

    return res.json({
      audio,
      mimeType: "audio/wav"
    });
  } catch (error) {
    console.error("BUJJI SPEECH ERROR:", error);

    return res.status(500).json({
      error: `Speech generation failed: ${error.message || "Check the server logs."}`
    });
  }
});

// Server health check
app.get("/health", (req, res) => {
  res.json({
    status: "Bujji server is running"
  });
});

// Latest robot answer
app.get("/robot-answer", (req, res) => {
  res.json({
    answer: latestRobotAnswer
  });
});

// Start server using Render's assigned port
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Bujji server is running on port ${PORT}`);
});
```