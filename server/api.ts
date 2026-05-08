import { Router } from 'express';
import db from './db.ts';
import { bot, setState, sendUsersExcel } from './bot.ts';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const apiRouter = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const ADMIN_ID = process.env.ADMIN_ID || '1986422890';

apiRouter.post('/auth/check-username', (req, res) => {
  const { username } = req.body;
  const formattedUsername = username.startsWith('@') ? username : '@' + username;
  const user = db.prepare('SELECT id FROM users WHERE username = ? OR username = ?').get(formattedUsername, username);
  
  if (!user) {
    res.json({ available: true });
  } else {
    // Generate suggestions
    const baseUsername = username.replace('@', '');
    const suggestions = [];
    for (let i = 1; i <= 3; i++) {
      const randomSuffix = Math.floor(Math.random() * 1000);
      const suggestion = `@${baseUsername}${randomSuffix}`;
      const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(suggestion);
      if (!exists) {
        suggestions.push(suggestion);
      }
    }
    res.json({ available: false, suggestions });
  }
});

apiRouter.post('/auth/signup', (req, res) => {
  const { first_name, last_name, phone_number, username, password, telegram_id: provided_telegram_id } = req.body;
  
  const rawUsername = username.startsWith('@') ? username.slice(1) : username;

  // Validate username
  if (!/^[a-z0-9_.]+$/.test(rawUsername)) {
    return res.status(400).json({ error: 'Username faqat kichik lotin harflari, raqamlar, "_" va "." dan iborat bo\'lishi kerak' });
  }

  // Validate password
  if (password.length < 4 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Parol kamida 4 ta belgidan, katta va kichik harflar hamda raqamlardan iborat bo\'lishi kerak' });
  }

  const formattedUsername = '@' + rawUsername;
  const telegram_id = provided_telegram_id ? String(provided_telegram_id) : `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const info = db.prepare('INSERT INTO users (telegram_id, first_name, last_name, username, phone_number, password) VALUES (?, ?, ?, ?, ?, ?)').run(telegram_id, first_name, last_name, formattedUsername, phone_number, password);
    db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').run(info.lastInsertRowid);
    res.json({ success: true, user: { id: info.lastInsertRowid, telegram_id, first_name, last_name, username: formattedUsername } });
  } catch (e: any) {
    if (e.message.includes('UNIQUE constraint failed: users.username')) {
      res.status(400).json({ error: 'Bu username band. Iltimos, boshqa username tanlang.' });
    } else if (e.message.includes('UNIQUE constraint failed: users.telegram_id')) {
      res.status(400).json({ error: 'Siz allaqachon ro\'yxatdan o\'tgansiz. Iltimos, tizimga kiring.' });
    } else {
      res.status(400).json({ error: 'Xatolik yuz berdi' });
    }
  }
});

apiRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  let formattedUsername = username;
  if (!formattedUsername.startsWith('@')) {
    formattedUsername = '@' + formattedUsername;
  }

  // Admin login check
  if (formattedUsername === '@admin' && password === '777888') {
    return res.json({ success: true, user: { telegram_id: ADMIN_ID, first_name: 'Admin', username: '@admin', isAdmin: true } });
  }

  const user = db.prepare('SELECT * FROM users WHERE (username = ? OR username = ?) AND password = ?').get(formattedUsername, username, password) as any;
  
  if (user) {
    if (user.telegram_id === ADMIN_ID) {
      user.isAdmin = true;
    }
    res.json({ success: true, user });
  } else {
    res.status(401).json({ error: 'Username yoki parol noto\'g\'ri' });
  }
});

apiRouter.get('/users/search', (req, res) => {
  const q = req.query.q as string;
  if (!q || q.length < 2) return res.json({ users: [] });
  
  const searchTerm = `%${q}%`;
  const users = db.prepare(`
    SELECT id, username, first_name, last_name, profile_photo 
    FROM users 
    WHERE username LIKE ? OR first_name LIKE ? OR last_name LIKE ?
    LIMIT 5
  `).all(searchTerm, searchTerm, searchTerm);
  
  res.json({ users });
});

function calculateEarnedBadges(stats: any) {
  const badges = [];
  if (stats.total_tests >= 1) badges.push('first_step');
  if (stats.correct_answers >= 50) badges.push('bronze');
  if (stats.correct_answers >= 100) badges.push('silver');
  if (stats.correct_answers >= 500) badges.push('gold');
  if (stats.total_tests >= 10 && (stats.time_spent / stats.total_tests) < 10) badges.push('speedster');
  if (stats.total_tests >= 10 && stats.wrong_answers === 0) badges.push('perfect');
  return badges;
}

apiRouter.get('/user/by-username/:username', (req, res) => {
  let username = req.params.username;
  if (!username.startsWith('@')) {
    username = '@' + username;
  }
  // Try with @ and without @
  let user = db.prepare('SELECT * FROM users WHERE username = ? OR username = ?').get(username, req.params.username) as any;
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(user.id) as any || { correct_answers: 0, wrong_answers: 0, time_spent: 0, total_tests: 0 };
  
  const rankQuery = db.prepare('SELECT COUNT(*) as rank FROM user_stats WHERE correct_answers > ? OR (correct_answers = ? AND time_spent < ?)').get(stats.correct_answers, stats.correct_answers, stats.time_spent) as any;
  
  const earned_badges = calculateEarnedBadges(stats);
  
  res.json({ ...user, stats, rank: rankQuery.rank + 1, earned_badges });
});

apiRouter.get('/user/:telegram_id', (req, res) => {
  let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.params.telegram_id) as any;
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(user.id) as any || { correct_answers: 0, wrong_answers: 0, time_spent: 0, total_tests: 0 };
  
  const rankQuery = db.prepare('SELECT COUNT(*) as rank FROM user_stats WHERE correct_answers > ? OR (correct_answers = ? AND time_spent < ?)').get(stats.correct_answers, stats.correct_answers, stats.time_spent) as any;
  
  const earned_badges = calculateEarnedBadges(stats);
  
  res.json({ ...user, stats, rank: rankQuery.rank + 1, earned_badges });
});

apiRouter.post('/user/register', (req, res) => {
  const { telegram_id, first_name, last_name, username, phone_number } = req.body;
  
  try {
    const info = db.prepare('INSERT INTO users (telegram_id, first_name, last_name, username, phone_number) VALUES (?, ?, ?, ?, ?)').run(telegram_id, first_name, last_name, username, phone_number);
    db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').run(info.lastInsertRowid);
    res.json({ success: true });
  } catch (e: any) {
    if (e.message.includes('UNIQUE constraint failed: users.username')) {
      try {
        const newUsername = username + '_' + Math.floor(Math.random() * 10000);
        const info = db.prepare('INSERT INTO users (telegram_id, first_name, last_name, username, phone_number) VALUES (?, ?, ?, ?, ?)').run(telegram_id, first_name, last_name, newUsername, phone_number);
        db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').run(info.lastInsertRowid);
        res.json({ success: true });
      } catch (err) {
        res.status(400).json({ error: 'Xatolik yuz berdi' });
      }
    } else {
      res.status(400).json({ error: 'Xatolik yuz berdi' });
    }
  }
});

apiRouter.put('/user/:telegram_id/name', (req, res) => {
  const { first_name, last_name, username, phone_number } = req.body;
  try {
    db.prepare('UPDATE users SET first_name = ?, last_name = ?, username = ?, phone_number = ? WHERE telegram_id = ?')
      .run(first_name, last_name || '', username, phone_number, req.params.telegram_id);
    res.json({ success: true });
  } catch (e: any) {
    if (e.message.includes('UNIQUE constraint failed: users.username')) {
      res.status(400).json({ error: 'Bu username band. Iltimos, boshqa username tanlang.' });
    } else {
      res.status(400).json({ error: 'Xatolik yuz berdi' });
    }
  }
});

apiRouter.put('/user/:telegram_id/customization', (req, res) => {
  const { status, accent_color, selected_badge } = req.body;
  try {
    db.prepare('UPDATE users SET status = ?, accent_color = ?, selected_badge = ? WHERE telegram_id = ?')
      .run(status || '', accent_color || 'indigo', selected_badge || '', req.params.telegram_id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: 'Xatolik yuz berdi' });
  }
});

apiRouter.post('/user/:telegram_id/photo', upload.single('photo'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No photo provided' });
  
  const fileUrl = `/uploads/${file.filename}`;
  db.prepare('UPDATE users SET profile_photo = ? WHERE telegram_id = ?').run(fileUrl, req.params.telegram_id);
  res.json({ success: true, profile_photo: fileUrl });
});

apiRouter.delete('/user/:telegram_id/photo', (req, res) => {
  db.prepare('UPDATE users SET profile_photo = NULL WHERE telegram_id = ?').run(req.params.telegram_id);
  res.json({ success: true });
});

apiRouter.get('/messages/:telegram_id', (req, res) => {
  const messages = db.prepare(`
    SELECT * FROM messages 
    WHERE (sender_id = ? AND receiver_id = ?) 
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `).all(req.params.telegram_id, ADMIN_ID, ADMIN_ID, req.params.telegram_id);
  res.json(messages);
});

apiRouter.post('/messages/:telegram_id', (req, res) => {
  const { content } = req.body;
  db.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)')
    .run(req.params.telegram_id, ADMIN_ID, content);
  res.json({ success: true });
});

apiRouter.get('/admin/chats', (req, res) => {
  const chats = db.prepare(`
    SELECT u.telegram_id, u.first_name, u.last_name, u.username, u.profile_photo,
           (SELECT content FROM messages WHERE (sender_id = u.telegram_id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.telegram_id) ORDER BY created_at DESC LIMIT 1) as last_message,
           (SELECT created_at FROM messages WHERE (sender_id = u.telegram_id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.telegram_id) ORDER BY created_at DESC LIMIT 1) as last_message_time,
           (SELECT COUNT(*) FROM messages WHERE sender_id = u.telegram_id AND receiver_id = ? AND is_read = 0) as unread_count
    FROM users u
    WHERE EXISTS (
      SELECT 1 FROM messages WHERE sender_id = u.telegram_id OR receiver_id = u.telegram_id
    )
    ORDER BY last_message_time DESC
  `).all(ADMIN_ID, ADMIN_ID, ADMIN_ID, ADMIN_ID, ADMIN_ID);
  res.json(chats);
});

apiRouter.post('/admin/chats/:telegram_id', (req, res) => {
  const { content } = req.body;
  db.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)')
    .run(ADMIN_ID, req.params.telegram_id, content);
  res.json({ success: true });
});

apiRouter.post('/admin/chats/:telegram_id/read', (req, res) => {
  db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?')
    .run(req.params.telegram_id, ADMIN_ID);
  res.json({ success: true });
});

apiRouter.get('/tests/random', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 1;
  const tests = db.prepare('SELECT * FROM tests ORDER BY RANDOM() LIMIT ?').all(limit) as any[];
  
  for (const test of tests) {
    if (test.file_id.startsWith('/uploads/')) {
      test.image_url = test.file_id;
    } else {
      try {
        test.image_url = await bot.getFileLink(test.file_id);
      } catch (e) {
        test.image_url = null;
      }
    }
  }
  
  res.json(tests);
});

apiRouter.post('/tests/submit', (req, res) => {
  const { telegram_id, correct, wrong, time_spent } = req.body;
  let user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegram_id) as any;
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  db.prepare('UPDATE user_stats SET total_tests = total_tests + ?, correct_answers = correct_answers + ?, wrong_answers = wrong_answers + ?, time_spent = time_spent + ? WHERE user_id = ?')
    .run(correct + wrong, correct, wrong, time_spent, user.id);
    
  res.json({ success: true });
});

apiRouter.get('/admin/tests', (req, res) => {
  const tests = db.prepare('SELECT id, correct_answer, created_at FROM tests ORDER BY id DESC').all();
  res.json(tests);
});

apiRouter.get('/admin/tests/:id', async (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id) as any;
  if (!test) return res.status(404).json({ error: 'Test not found' });
  
  if (test.file_id.startsWith('/uploads/')) {
    test.image_url = test.file_id;
  } else {
    try {
      test.image_url = await bot.getFileLink(test.file_id);
    } catch (e) {
      test.image_url = null;
    }
  }
  res.json(test);
});

apiRouter.delete('/admin/tests/:id', (req, res) => {
  db.prepare('DELETE FROM tests WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

apiRouter.put('/admin/tests/:id', upload.single('image'), (req, res) => {
  const { correct_answer } = req.body;
  const file = req.file;
  
  if (file) {
    const fileUrl = `/uploads/${file.filename}`;
    db.prepare('UPDATE tests SET correct_answer = ?, file_id = ? WHERE id = ?').run(correct_answer, fileUrl, req.params.id);
  } else {
    db.prepare('UPDATE tests SET correct_answer = ? WHERE id = ?').run(correct_answer, req.params.id);
  }
  res.json({ success: true });
});

apiRouter.get('/admin/channels', (req, res) => {
  const channels = db.prepare('SELECT * FROM channels').all();
  res.json(channels);
});

apiRouter.post('/admin/channels', (req, res) => {
  const { username } = req.body;
  try {
    const info = db.prepare('INSERT INTO channels (username) VALUES (?)').run(username);
    res.json({ id: info.lastInsertRowid, username });
  } catch (e) {
    res.status(400).json({ error: 'Channel already exists' });
  }
});

apiRouter.delete('/admin/channels/:id', (req, res) => {
  db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

apiRouter.get('/leaderboard', (req, res) => {
  const topUsers = db.prepare(`
    SELECT u.first_name, u.last_name, u.telegram_id, u.profile_photo, s.correct_answers, s.total_tests
    FROM users u
    JOIN user_stats s ON u.id = s.user_id
    WHERE s.total_tests > 0
    ORDER BY s.correct_answers DESC, s.time_spent ASC
    LIMIT 50
  `).all();
  
  res.json(topUsers);
});

apiRouter.get('/admin/stats', (req, res) => {
  const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  const totalTests = (db.prepare('SELECT COUNT(*) as count FROM tests').get() as any).count;
  
  const topUsers = db.prepare(`
    SELECT u.first_name, u.last_name, u.telegram_id, u.profile_photo, s.correct_answers, s.total_tests
    FROM users u
    JOIN user_stats s ON u.id = s.user_id
    ORDER BY s.correct_answers DESC, s.time_spent ASC
    LIMIT 30
  `).all();
  
  res.json({ totalUsers, totalTests, topUsers });
});

apiRouter.post('/admin/trigger-test-create', (req, res) => {
  setState(ADMIN_ID, 'WAITING_FOR_TEST_PHOTO');
  bot.sendMessage(ADMIN_ID, 'Test rasmini yuboring:');
  res.json({ success: true });
});

apiRouter.post('/admin/tests', upload.single('image'), (req, res) => {
  try {
    const { correct_answer } = req.body;
    const file = req.file;
    
    if (!file || !correct_answer) {
      return res.status(400).json({ error: 'Image and correct_answer are required' });
    }

    const fileUrl = `/uploads/${file.filename}`;
    const info = db.prepare('INSERT INTO tests (file_id, correct_answer) VALUES (?, ?)').run(fileUrl, correct_answer);
    
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (error) {
    console.error('Error creating test:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

apiRouter.post('/admin/export-users', async (req, res) => {
  await sendUsersExcel(parseInt(ADMIN_ID));
  res.json({ success: true });
});
