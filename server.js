require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Mindmelo backend running ✅");
});

// Chat route
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.json({ reply: "No message received" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a calm, supportive, emotionally intelligent mental health assistant. Speak naturally like a human and give meaningful responses."
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    const data = await response.json();

    // 🔥 DEBUG LINE (VERY IMPORTANT)
    console.log("GROQ RESPONSE:", JSON.stringify(data, null, 2));

    let reply = "I'm here for you 💙";

    if (data && data.choices && data.choices.length > 0) {
      reply = data.choices[0].message.content;
    }

    res.json({ reply });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.json({ reply: "Error connecting to AI 💔" });
  }
});

app.listen(5000, () => {
  console.log("🚀 SERVER RUNNING ON http://localhost:5000");
});