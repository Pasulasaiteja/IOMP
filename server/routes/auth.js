// routes/auth.js — Register, Login, Profile, Password
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getDb, all, get, run } = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
    if (!email.includes('@')) return res.status(400).json({ error: 'Invalid email address.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const db = await getDb();
    const existing = get(db, 'SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 12);
    const { lastInsertRowid: userId } = run(db,
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hash]
    );
    run(db, 'INSERT OR IGNORE INTO preferences (user_id) VALUES (?)', [userId]);

    const token = makeToken(userId);
    res.status(201).json({ token, user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), dailyGoal: 360, streak: 0 } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const db = await getDb();
    const user = get(db, 'SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) return res.status(401).json({ error: 'No account found with that email.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password.' });

    const token = makeToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, dailyGoal: user.daily_goal, streak: user.streak } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const user = get(db, 'SELECT id, name, email, daily_goal, streak, created_at FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const prefs = get(db, 'SELECT * FROM preferences WHERE user_id = ?', [req.userId]) || {};
    res.json({ ...user, preferences: prefs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email || !email.includes('@')) return res.status(400).json({ error: 'Valid name and email required.' });
    const db = await getDb();
    const conflict = get(db, 'SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase().trim(), req.userId]);
    if (conflict) return res.status(409).json({ error: 'Email already in use.' });
    run(db, 'UPDATE users SET name = ?, email = ? WHERE id = ?', [name.trim(), email.toLowerCase().trim(), req.userId]);
    res.json({ success: true, name: name.trim(), email: email.toLowerCase().trim() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// PUT /api/auth/password
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    const db = await getDb();
    const user = get(db, 'SELECT password FROM users WHERE id = ?', [req.userId]);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(newPassword, 12);
    run(db, 'UPDATE users SET password = ? WHERE id = ?', [hash, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

module.exports = router;
