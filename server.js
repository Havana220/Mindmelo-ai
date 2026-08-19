require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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
   🌱 DAILY CHECK-IN SCHEMA
========================= */

const checkInSchema = new mongoose.Schema({
  username: String,

  mood: {
    type: String,
    required: true
  },

  note: {
    type: String,
    default: ""
  },

  date: {
    type: Date,
    default: Date.now
  }
});

const CheckIn = mongoose.model(
  "CheckIn",
  checkInSchema,
  "checkins"
);

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

    console.log("=================================");
console.log("👤 NAME RECEIVED FROM FRONTEND:", userName);
console.log("💬 MESSAGE RECEIVED:", userMessage);
console.log("=================================");

    if (!userMessage) {
      return res.json({ reply: "No message", mood: "neutral" });
    }

    // 🔍 FIND USER
    let user = await User.findOne({ username: userName });

    console.log("🔎 USER FOUND IN DATABASE:", user ? user.username : "NO USER");
console.log("💬 EXISTING MESSAGES:", user ? user.messages.length : 0);

    if (!user) {
      user = new User({
        username: userName,
        messages: [],
        moods: []
      });
    }

    // 🔥 MOOD DETECTION
let msg = userMessage.toLowerCase().trim();

let mood = "neutral";

// ------------------------------------
// 😔 SAD / LOW
// ------------------------------------
if (
  msg.includes("don't feel good") ||
  msg.includes("dont feel good") ||
  msg.includes("not feeling good") ||
  msg.includes("not feel good") ||
  msg.includes("don't feel well") ||
  msg.includes("dont feel well") ||
  msg.includes("not feeling well") ||
  msg.includes("feel bad") ||
  msg.includes("feeling bad") ||
  msg.includes("feel terrible") ||
  msg.includes("feeling terrible") ||
  msg.includes("feel awful") ||
  msg.includes("feeling awful") ||
  msg.includes("feeling low") ||
  msg.includes("feel low") ||
  msg.includes("sad") ||
  msg.includes("lonely") ||
  msg.includes("depressed") ||
  msg.includes("unhappy") ||
  msg.includes("crying") ||
  msg.includes("want to cry")
) {
  mood = "sad";
}

// ------------------------------------
// 😓 STRESSED
// ------------------------------------
else if (
  msg.includes("stressed") ||
  msg.includes("stress") ||
  msg.includes("overwhelmed") ||
  msg.includes("under pressure") ||
  msg.includes("too much work") ||
  msg.includes("can't cope") ||
  msg.includes("cant cope") ||
  msg.includes("anxious") ||
  msg.includes("anxiety") ||
  msg.includes("worried")
) {
  mood = "stressed";
}

// ------------------------------------
// 😊 HAPPY
// ------------------------------------
else if (
  msg.includes("i'm happy") ||
  msg.includes("im happy") ||
  msg.includes("feeling happy") ||
  msg.includes("feel happy") ||
  msg.includes("i'm feeling good") ||
  msg.includes("im feeling good") ||
  msg.includes("i feel good") ||
  msg.includes("feeling great") ||
  msg.includes("feel great") ||
  msg.includes("i'm great") ||
  msg.includes("im great") ||
  msg.includes("excited") ||
  msg.includes("amazing") ||
  msg.includes("wonderful") ||
  msg.includes("awesome")
) {
  mood = "happy";
}

// ------------------------------------
// 🙂 OTHERWISE = NEUTRAL
// ------------------------------------
else {
  mood = "neutral";
}
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

console.log("📔 JOURNALS FOUND FOR:", userName);
console.log("📔 JOURNALS:", journals);

let journalContext = journals
  .map(j => j.text.slice(0, 100))
  .join(" | ");

console.log("🧠 JOURNAL CONTEXT SENT TO AI:", journalContext);

    // 🧠 AI CALL
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content: `You are a caring and emotionally intelligent mental health assistant.

User name: ${userName}

Recent moods:
${lastMoods}

Private journal insights:
${journalContext || "No journal entries available."}

Important memory rules:
- NEVER invent memories, past conversations, journal entries, events, habits, or personal details.
- NEVER claim that the user previously told you something unless that information is actually present in the conversation history or journal insights provided above.
- If this is a new user or there is no previous context, treat the conversation as a first conversation.
- Do not say "I remember you mentioned..." unless the provided context actually contains that information.
- Do not invent details such as walks, meetings, routines, college activities, relationships, or past feelings.
- Use journal insights naturally only when they actually exist and are relevant.
- If there is no journal context, simply respond to the user's current message.
- Be warm, supportive, conversational, and human.
- Keep responses reasonably concise.
- Avoid generic lectures and repetitive phrases.

Your response must be based only on:
1. The current user message.
2. The conversation history provided to you.
3. The journal insights provided to you.
4. The recent moods provided to you.

Never fabricate personal context.`
          },
          ...user.messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        ]
      })
    });

    const data = await response.json();

console.log("🤖 GROQ RESPONSE:", data);

if (!response.ok) {
  throw new Error(data.error?.message || "Groq API error");
}

const reply =
  data.choices?.[0]?.message?.content ||
  "I'm here 💙";

    // 💙 AI AFFIRMATION
const affirmationRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "openai/gpt-oss-20b",
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

// =====================================
// 📜 CHAT HISTORY
// =====================================

app.get("/history/:username", async (req, res) => {
  try {

    const username = req.params.username;

    const user = await User.findOne({
      username: username
    });

    if (!user) {
      return res.json({
        success: true,
        messages: []
      });
    }

    res.json({
      success: true,
      messages: user.messages || []
    });

  } catch (error) {

    console.log("❌ History Error:", error);

    res.status(500).json({
      success: false,
      messages: []
    });

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
   🌱 DAILY CHECK-IN
========================= */

app.post("/checkin", async (req, res) => {
  try {
    const { name, mood, note } = req.body;

    // Validate required fields
    if (!name || !mood) {
      return res.status(400).json({
        success: false,
        message: "Name and mood are required"
      });
    }

    // Create check-in
    const checkIn = new CheckIn({
      username: name,
      mood: mood,
      note: note || ""
    });

    // Save to MongoDB
    await checkIn.save();

    console.log("✅ Check-in saved:", checkIn);

    res.json({
      success: true,
      message: "Check-in saved successfully",
      checkIn: checkIn
    });

  } catch (err) {
    console.log("❌ Check-in Error:", err);

    res.status(500).json({
      success: false,
      message: "Could not save check-in"
    });
  }
});


// =====================================
// 🌱 GET DAILY CHECK-INS
// =====================================

app.get("/checkins/:username", async (req, res) => {

  try {

    const username = req.params.username;

    const checkIns = await CheckIn
      .find({ username: username })
      .sort({ date: -1 });

    res.json({
      success: true,
      count: checkIns.length,
      checkIns: checkIns
    });

  } catch (err) {

    console.log("❌ Get Check-Ins Error:", err);

    res.status(500).json({
      success: false,
      message: "Could not fetch check-ins",
      checkIns: []
    });

  }

});

/* =========================
   📜 CHAT HISTORY
========================= */

app.get("/history/:username", async (req, res) => {

  try {

    const username =
      req.params.username;

    const user =
      await User.findOne({
        username: username
      });

    if (!user) {

      return res.json({
        success: true,
        messages: []
      });

    }


    res.json({

      success: true,

      messages:
        user.messages || []

    });

  }

  catch (error) {

    console.log(
      "❌ HISTORY ERROR:",
      error
    );

    res.status(500).json({

      success: false,

      messages: []

    });

  }

});

/* =========================
   📊 INSIGHTS
========================= */

app.get("/insights/:username", async (req, res) => {
  try {

    const username = decodeURIComponent(req.params.username).trim();

    console.log("📊 INSIGHTS REQUEST FOR:", username);

    /* =========================
       💬 CONVERSATION MOODS
    ========================= */

    const user = await User.findOne({
      username: {
        $regex: `^${username}$`,
        $options: "i"
      }
    });

    const conversationMoods = user?.moods || [];

    console.log(
      "💬 CONVERSATION MOODS:",
      conversationMoods
    );


    /* =========================
       🌱 DAILY CHECK-IN MOODS
    ========================= */

    const checkIns = await CheckIn
      .find({
        username: {
          $regex: `^${username}$`,
          $options: "i"
        }
      })
      .sort({ date: 1 });

    const checkinMoods = checkIns.map(
      checkIn => checkIn.mood
    );

    console.log(
      "🌱 CHECK-INS FOUND:",
      checkIns.length
    );

    console.log(
      "🌱 CHECK-IN MOODS:",
      checkinMoods
    );


    /* =========================
       📈 CONVERSATION COUNTS
    ========================= */

    const conversationCounts = {
      happy: 0,
      sad: 0,
      stressed: 0,
      neutral: 0
    };

    conversationMoods.forEach(mood => {
      if (conversationCounts[mood] !== undefined) {
        conversationCounts[mood]++;
      }
    });


    /* =========================
       🌱 CHECK-IN COUNTS
    ========================= */

    const checkinCounts = {
      happy: 0,
      great: 0,
      okay: 0,
      neutral: 0,
      low: 0,
      sad: 0,
      stressed: 0,
      numb: 0,
      tired: 0
    };

    checkinMoods.forEach(mood => {
      if (checkinCounts[mood] !== undefined) {
        checkinCounts[mood]++;
      }
    });


    /* =========================
       🧠 LATEST CONVERSATION MOOD
    ========================= */

    const latestConversationMood =
      conversationMoods.length > 0
        ? conversationMoods[conversationMoods.length - 1]
        : null;


    /* =========================
       🌱 LATEST CHECK-IN MOOD
    ========================= */

    const latestCheckinMood =
      checkinMoods.length > 0
        ? checkinMoods[checkinMoods.length - 1]
        : null;


    /* =========================
       📤 SEND INSIGHTS
    ========================= */

    res.json({

      success: true,

      // 💬 Conversation data
      conversationCount:
        conversationMoods.length,

      conversationMoods:
        conversationMoods,

      conversationCounts:
        conversationCounts,

      latestConversationMood:
        latestConversationMood,


      // 🌱 Daily check-in data
      checkinCount:
        checkinMoods.length,

      checkinMoods:
        checkinMoods,

      checkinCounts:
        checkinCounts,

      latestCheckinMood:
        latestCheckinMood

    });


  } catch (error) {

    console.log(
      "❌ INSIGHTS ERROR:",
      error
    );

    res.status(500).json({

      success: false,

      message: "Unable to load insights"

    });

  }
});

// 🔍 CHECK GROQ MODELS
async function checkGroqModels() {
  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/models",
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        }
      }
    );

    const data = await response.json();

    console.log("🔍 AVAILABLE GROQ MODELS:");

    if (data.data) {
      data.data.forEach(model => {
        console.log(model.id);
      });
    } else {
      console.log(data);
    }

  } catch (error) {
    console.log("❌ MODEL CHECK ERROR:", error);
  }
}

checkGroqModels();

/* =========================
   🚀 START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});