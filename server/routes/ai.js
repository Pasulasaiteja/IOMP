// routes/ai.js — AI Coaching with Google Gemini
const express = require('express');
const fetch   = require('node-fetch');
const requireAuth = require('../middleware/auth');
const { getDb, all, get } = require('../db');

const router = express.Router();
router.use(requireAuth);

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

router.post('/chat', async (req, res) => {
  const { messages } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(500).json({ error: 'AI API Key not configured on server.' });
  }

  // Fetch user data for context
  const db = await getDb();
  const user = get(db, 'SELECT daily_goal FROM users WHERE id = ?', [req.userId]);
  const today = new Date().toISOString().slice(0, 10);
  const usage = all(db, 'SELECT app_name, minutes FROM screen_time WHERE user_id = ? AND date = ?', [req.userId, today]);
  
  const usageContext = usage.map(u => `${u.app_name}: ${u.minutes}m`).join(', ') || 'No usage recorded yet today.';

  const systemPrompt = `You are ZenScreen AI Coach, a warm, encouraging digital wellness assistant. 
  User Goal: ${user ? user.daily_goal : 360} minutes per day.
  Today's Usage: ${usageContext}
  
  Keep responses concise (2-4 sentences max), warm, and actionable. Use emojis. 
  Focus on small, practical steps to reduce screen time.`;

  // Format messages for Gemini API
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  // Add system prompt as the first message or instruction
  contents.unshift({
    role: 'user',
    parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}` }]
  });

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Gemini Error:', data.error);
      return res.status(500).json({ error: 'AI Service Error' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure how to respond to that. Let's try focusing on your goals!";
    res.json({ reply });

  } catch (err) {
    console.error('AI Route Error:', err);
    res.status(500).json({ error: 'Failed to connect to AI service.' });
  }
});

module.exports = router;
