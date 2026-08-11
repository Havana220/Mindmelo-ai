require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   🟢 MONGODB CONNECT
========================= */
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ MongoDB Connected"))
.catch(err=>console.log("❌ DB Error:", err));

/* =========================
   🧠 SCHEMA
========================= */
const userSchema = new mongoose.Schema({
  username: String,
  messages: [
    {
      role: String,
      content: String,
      mood: String
    }
  ],
  moods: [String]
});

const User = mongoose.model("User", userSchema,"users");

const journalSchema = new mongoose.Schema({
  username: String,
  text: String,
  date: { type: Date, default: Date.now }
});

const Journal = mongoose.model("Journal", journalSchema, "journals");

/* =========================
   🚀 ROUTES
========================= */

// TEST
app.get("/", (req, res) => {
  res.send("Mindmelo backend running ✅");
});

// CHAT
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const userName = req.body.name || "Friend";

    if (!userMessage) {
      return res.json({ reply: "No message", mood: "neutral" });
    }

    // 🔍 FIND USER
    let user = await User.findOne({ username: userName });

    if (!user) {
      user = new User({
        username: userName,
        messages: [],
        moods: []
      });
    }

    // 🔥 MOOD DETECTION
    let msg = userMessage.toLowerCase();
    let mood = "neutral";

    if (
      msg.includes("stress") ||
      msg.includes("tired") ||
      msg.includes("overwhelmed")
    ) mood = "stressed";

    else if (
      msg.includes("sad") ||
      msg.includes("lonely") ||
      msg.includes("depressed")
    ) mood = "sad";

    else if (
      msg.includes("happy") ||
      msg.includes("good") ||
      msg.includes("great")
    ) mood = "happy";

    // ➕ SAVE USER MESSAGE
    user.messages.push({
      role: "user",
      content: userMessage,
      mood: mood
    });

    user.moods.push(mood);

    // 🔥 LAST 3 MOODS
    const lastMoods = user.moods.slice(-3).join(", ");

    // 📝 FETCH LAST 2 JOURNAL ENTRIES
let journals = await Journal.find({ username: userName })
  .sort({ date: -1 })
  .limit(2);

let journalContext = journals
  .map(j => j.text.slice(0, 100)) // limit length
  .join(" | ");

    // 🧠 AI CALL
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
            content: `You are a caring and emotionally intelligent mental health assistant.

User name: ${userName}

Recent moods: ${lastMoods}

Private journal insights:
${journalContext}

Instructions:
- Use journal insights naturally in conversation when relevant
- DO NOT say "from your journal"
- Make it feel like you remember the user
- Be slightly specific, not generic
- Keep it warm, calm, and human

Example style:
"I know you've been feeling stuck and a bit lost lately…"

Avoid:
- Being too generic
- Giving long lectures
- Repeating the same phrases

Be supportive, conversational, and real.`
          },
          ...user.messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm here 💙";

    // 💙 AI AFFIRMATION
const affirmationRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
        content: "Give ONLY one short emotional affirmation (max 10 words)."
      },
      {
        role: "user",
        content: userMessage
      }
    ],
    temperature: 0.9
  })
});

const affirmationData = await affirmationRes.json();

let affirmation = "You're doing okay 💙";

if (
  affirmationData &&
  affirmationData.choices &&
  affirmationData.choices[0] &&
  affirmationData.choices[0].message &&
  affirmationData.choices[0].message.content
) {
  affirmation = affirmationData.choices[0].message.content.trim();
}

    // ➕ SAVE AI MESSAGE
    user.messages.push({
      role: "assistant",
      content: reply,
      mood: mood
    });

    // 💾 SAVE TO DATABASE
    console.log("Saving user:", user);
    await user.save();

    // ✅ RESPONSE
    res.json({
      reply: reply,
      mood: mood,
      moodHistory: user.moods,
      affirmation: affirmation 
    });

  } catch (err) {
    console.log("ERROR:", err);
    res.json({ reply: "Error 💔", mood: "neutral" });
  }

});

// 📝 SAVE JOURNAL
app.post("/journal", async (req, res) => {
  try {
    const { name, text } = req.body;

    const entry = new Journal({
      username: name,
      text: text
    });

    await entry.save();

    res.json({ message: "Saved successfully ✅" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error ❌" });
  }
});

// 📖 GET JOURNAL
app.get("/journal/:username", async (req, res) => {
  try {
    const data = await Journal.find({ username: req.params.username });
    res.json(data);
  } catch (err) {
    res.status(500).json([]);
  }
});

/* =========================
   🚀 START SERVER
========================= */
app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});