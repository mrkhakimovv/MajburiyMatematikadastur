import { Router } from 'express';
import { dbFirestore } from './firebase.ts';
import ExcelJS from 'exceljs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const apiRouter = Router();

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

apiRouter.post('/auth/check-username', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const { username, current_user_id } = req.body;
  const formattedUsername = username.startsWith('@') ? username : '@' + username;
  
  const snapshot = await dbFirestore.collection('users')
    .where('username', 'in', [formattedUsername, username]).get();
    
  let available = false;
  if (snapshot.empty) {
    available = true;
  } else if (current_user_id && snapshot.docs.length === 1 && snapshot.docs[0].id === current_user_id) {
    available = true;
  }

  if (available) {
    res.json({ available: true });
  } else {
    const baseUsername = username.replace('@', '');
    const suggestions = [];
    for (let i = 1; i <= 3; i++) {
      const randomSuffix = Math.floor(Math.random() * 1000);
      const suggestion = `@${baseUsername}${randomSuffix}`;
      const ex = await dbFirestore.collection('users').where('username', '==', suggestion).get();
      if (ex.empty) {
        suggestions.push(suggestion);
      }
    }
    res.json({ available: false, suggestions });
  }
});

apiRouter.post('/auth/signup', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const { first_name, last_name, phone_number, username, password, telegram_id: provided_telegram_id } = req.body;
  
  const rawUsername = username.startsWith('@') ? username.slice(1) : username;

  if (!/^[a-z0-9_.]+$/.test(rawUsername)) {
    return res.status(400).json({ error: "Username faqat kichik lotin harflari, raqamlar, '_' va '.' dan iborat bo'lishi kerak" });
  }

  const formattedUsername = '@' + rawUsername;

  try {
    const existingUser = await dbFirestore.collection('users').where('username', '==', formattedUsername).get();
    if (!existingUser.empty) {
      return res.status(400).json({ error: "Ushbu username band. Iltimos boshqasini tanlang." });
    }

  const telegram_id = provided_telegram_id ? String(provided_telegram_id) : `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const userSnap = await dbFirestore.collection('users').doc(telegram_id).get();
    if (userSnap.exists) {
      return res.status(400).json({ error: "Siz allaqachon ro'yxatdan o'tgansiz. Iltimos, tizimga kiring." });
    }
    const usernameSnap = await dbFirestore.collection('users').where('username', '==', formattedUsername).get();
    if (!usernameSnap.empty) {
      return res.status(400).json({ error: 'Bu username band. Iltimos, boshqa username tanlang.' });
    }

    const userData = {
      telegram_id, first_name, last_name, username: formattedUsername, phone_number, password,
      registered_at: Date.now(),
      total_tests: 0, correct_answers: 0, wrong_answers: 0, time_spent: 0
    };
    await dbFirestore.collection('users').doc(telegram_id).set(userData);
    
    res.json({ success: true, user: { id: telegram_id, telegram_id, first_name, last_name, username: formattedUsername } });
  } catch (e: any) {
    res.status(400).json({ error: 'Xatolik yuz berdi' });
  }
});

apiRouter.post('/auth/login', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const { username, password } = req.body;
  let formattedUsername = username;
  if (!formattedUsername.startsWith('@')) {
    formattedUsername = '@' + formattedUsername;
  }

  if (formattedUsername === '@admin' && password === '777888') {
    return res.json({ success: true, user: { telegram_id: ADMIN_ID, first_name: 'Admin', username: '@admin', isAdmin: true } });
  }

  const snapshot = await dbFirestore.collection('users')
    .where('username', 'in', [formattedUsername, username])
    .where('password', '==', password).get();
  
  if (!snapshot.empty) {
    const user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
    
    if (user.is_blocked) {
      return res.status(403).json({ 
        error: "Siz bloklangansiz, dasturdan foydalana olmaysiz.", 
        isBlocked: true 
      });
    }

    if (user.telegram_id === ADMIN_ID) {
      user.isAdmin = true;
    }
    res.json({ success: true, user });
  } else {
    res.status(401).json({ error: "Username yoki parol noto'g'ri" });
  }
});

apiRouter.get('/users/search', async (req, res) => {
  if (!dbFirestore) return res.json({ users: [] });
  const q = req.query.q as string;
  if (!q || q.length < 2) return res.json({ users: [] });
  
  const snapshot = await dbFirestore.collection('users').get();
  const qLower = q.toLowerCase();
  
  const users = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(u => 
      (u.username && u.username.toLowerCase().includes(qLower)) || 
      (u.first_name && u.first_name.toLowerCase().includes(qLower)) ||
      (u.last_name && u.last_name.toLowerCase().includes(qLower))
    )
    .slice(0, 5)
    .map(u => ({ id: u.id, username: u.username, first_name: u.first_name, last_name: u.last_name, profile_photo: u.profile_photo }));
    
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

apiRouter.get('/user/by-username/:username', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  let username = req.params.username;
  if (!username.startsWith('@')) username = '@' + username;
  
  const snap = await dbFirestore.collection('users').where('username', 'in', [username, req.params.username]).get();
  if (snap.empty) return res.status(404).json({ error: 'User not found' });
  
  const user = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
  const stats = {
    correct_answers: user.correct_answers || 0,
    wrong_answers: user.wrong_answers || 0,
    time_spent: user.time_spent || 0,
    total_tests: user.total_tests || 0
  };
  
  // Calculate rank (in-memory for simplicity to avoid composite index)
  const allUsersSnap = await dbFirestore.collection('users').get();
  let rank = 1;
  allUsersSnap.docs.forEach(doc => {
    const d = doc.data();
    if (d.correct_answers > stats.correct_answers || 
        (d.correct_answers === stats.correct_answers && d.time_spent < stats.time_spent)) {
      rank++;
    }
  });
  
  const earned_badges = calculateEarnedBadges(stats);
  res.json({ ...user, stats, rank, earned_badges });
});

apiRouter.get('/user/:telegram_id', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const doc = await dbFirestore.collection('users').doc(req.params.telegram_id).get();
  if (!doc.exists) return res.status(404).json({ error: 'User not found' });
  
  const user = { id: doc.id, ...doc.data() } as any;

  if (user.is_blocked) {
    return res.status(403).json({ error: 'User is blocked', isBlocked: true });
  }

  const stats = {
    correct_answers: user.correct_answers || 0,
    wrong_answers: user.wrong_answers || 0,
    time_spent: user.time_spent || 0,
    total_tests: user.total_tests || 0
  };

  const allUsersSnap = await dbFirestore.collection('users').get();
  let rank = 1;
  allUsersSnap.docs.forEach(dDoc => {
    const d = dDoc.data();
    if (d.correct_answers > stats.correct_answers || 
        (d.correct_answers === stats.correct_answers && d.time_spent < stats.time_spent)) {
      rank++;
    }
  });

  const earned_badges = calculateEarnedBadges(stats);
  res.json({ ...user, stats, rank, earned_badges });
});

apiRouter.post('/user/register', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const { telegram_id, first_name, last_name, username, phone_number } = req.body;
  try {
    const usernameSnap = await dbFirestore.collection('users').where('username', '==', username).get();
    let finalUsername = username;
    if (!usernameSnap.empty) {
      finalUsername = username + '_' + Math.floor(Math.random() * 10000);
    }
    await dbFirestore.collection('users').doc(telegram_id).set({
      telegram_id, first_name, last_name, username: finalUsername, phone_number,
      total_tests: 0, correct_answers: 0, wrong_answers: 0, time_spent: 0, registered_at: Date.now()
    }, { merge: true });
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: 'Xatolik yuz berdi' });
  }
});

apiRouter.put('/user/:telegram_id/name', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const { first_name, last_name, username, phone_number } = req.body;
  try {
    const snap = await dbFirestore.collection('users').where('username', '==', username).get();
    if (!snap.empty && snap.docs[0].id !== req.params.telegram_id) {
       return res.status(400).json({ error: 'Bu username band. Iltimos, boshqa username tanlang.' });
    }
    await dbFirestore.collection('users').doc(req.params.telegram_id).update({
      first_name, last_name: last_name || '', username, phone_number
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: 'Xatolik yuz berdi' });
  }
});

apiRouter.put('/user/:telegram_id/customization', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const { status, accent_color, selected_badge } = req.body;
  try {
    await dbFirestore.collection('users').doc(req.params.telegram_id).update({
      status: status || '', accent_color: accent_color || 'indigo', selected_badge: selected_badge || ''
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: 'Xatolik yuz berdi' });
  }
});

apiRouter.post('/user/:telegram_id/photo', upload.single('photo'), async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No photo provided' });
  const fileUrl = `/uploads/${file.filename}`;
  await dbFirestore.collection('users').doc(req.params.telegram_id).update({ profile_photo: fileUrl });
  res.json({ success: true, profile_photo: fileUrl });
});

apiRouter.delete('/user/:telegram_id/photo', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  await dbFirestore.collection('users').doc(req.params.telegram_id).update({ profile_photo: null });
  res.json({ success: true });
});

apiRouter.get('/messages/:telegram_id', async (req, res) => {
  if (!dbFirestore) return res.json([]);
  const tId = req.params.telegram_id;
  // Get all messages and filter in memory to avoid composite index requirement
  const snap = await dbFirestore.collection('messages').get();
  const msgs = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .filter(m => (m.sender_id === tId && m.receiver_id === ADMIN_ID) || (m.sender_id === ADMIN_ID && m.receiver_id === tId))
    .sort((a, b) => a.created_at - b.created_at);
  res.json(msgs);
});

apiRouter.post('/messages/:telegram_id', async (req, res) => {
  if (!dbFirestore) return res.json({ success: true });
  const { content } = req.body;
  await dbFirestore.collection('messages').add({
    sender_id: req.params.telegram_id, receiver_id: ADMIN_ID, content, created_at: Date.now(), is_read: false
  });
  res.json({ success: true });
});

apiRouter.get('/admin/chats', async (req, res) => {
  if (!dbFirestore) return res.json([]);
  const usersSnap = await dbFirestore.collection('users').get();
  const msgsSnap = await dbFirestore.collection('messages').get();
  const messages = msgsSnap.docs.map(d => d.data() as any);
  
  const chats = usersSnap.docs.map(doc => {
    const u = doc.data() as any;
    const userMsgs = messages.filter(m => m.sender_id === u.telegram_id || m.receiver_id === u.telegram_id);
    if (userMsgs.length === 0) return null;
    userMsgs.sort((a, b) => b.created_at - a.created_at);
    const lastMsg = userMsgs[0];
    const unread = userMsgs.filter(m => m.sender_id === u.telegram_id && m.receiver_id === ADMIN_ID && !m.is_read).length;
    return {
      telegram_id: u.telegram_id,
      first_name: u.first_name,
      last_name: u.last_name,
      username: u.username,
      profile_photo: u.profile_photo,
      last_message: lastMsg.content,
      last_message_time: lastMsg.created_at,
      unread_count: unread
    };
  }).filter(c => c !== null).sort((a: any, b: any) => b.last_message_time - a.last_message_time);
  res.json(chats);
});

apiRouter.post('/admin/chats/:telegram_id', async (req, res) => {
  if (!dbFirestore) return res.json({ success: true });
  const { content } = req.body;
  await dbFirestore.collection('messages').add({
    sender_id: ADMIN_ID, receiver_id: req.params.telegram_id, content, created_at: Date.now(), is_read: false
  });
  res.json({ success: true });
});

apiRouter.post('/admin/chats/:telegram_id/read', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const snap = await dbFirestore.collection('messages').where('sender_id', '==', req.params.telegram_id).where('receiver_id', '==', ADMIN_ID).get();
  const batch = dbFirestore.batch();
  snap.docs.forEach(doc => {
    batch.update(doc.ref, { is_read: true });
  });
  await batch.commit();
  res.json({ success: true });
});

apiRouter.get('/tests/random', async (req, res) => {
  if (!dbFirestore) return res.json([]);
  const limit = parseInt(req.query.limit as string) || 1;
  const snap = await dbFirestore.collection('tests').get();
  let tests = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  // shuffle
  tests = tests.sort(() => 0.5 - Math.random()).slice(0, limit);
  
  for (const test of tests) {
    if (test.file_id && test.file_id.startsWith('/uploads/')) {
      test.image_url = test.file_id;
    } else {
      test.image_url = null;
    }
  }
  res.json(tests);
});

apiRouter.post('/tests/submit', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'Db not connected' });
  const { telegram_id, correct, wrong, time_spent, variant_id } = req.body;
  const docRef = dbFirestore.collection('users').doc(telegram_id);
  const doc = await docRef.get();
  if (!doc.exists) return res.status(404).json({ error: 'User not found' });
  const data = doc.data() as any;
  await docRef.update({
    total_tests: (data.total_tests || 0) + correct + wrong,
    correct_answers: (data.correct_answers || 0) + correct,
    wrong_answers: (data.wrong_answers || 0) + wrong,
    time_spent: (data.time_spent || 0) + time_spent
  });

  if (variant_id) {
    await dbFirestore.collection('variant_results').add({
      variant_id: variant_id,
      telegram_id: telegram_id,
      user_name: data.first_name + (data.last_name ? ' ' + data.last_name : ''),
      username: data.username || '',
      phone_number: data.phone_number || '',
      correct: correct,
      wrong: wrong,
      time_spent: time_spent,
      created_at: Date.now()
    });
  }

  res.json({ success: true });
});

apiRouter.get('/admin/tests', async (req, res) => {
  if (!dbFirestore) return res.json([]);
  const snap = await dbFirestore.collection('tests').get();
  const tests = snap.docs.map(d => {
    const data = d.data() as any;
    if (data.file_id && data.file_id.startsWith('/uploads/')) {
      data.image_url = data.file_id;
    } else {
      data.image_url = null;
    }
    return { id: d.id, ...data };
  }).sort((a: any, b: any) => b.created_at - a.created_at);
  res.json(tests);
});

apiRouter.get('/admin/tests/:id', async (req, res) => {
  if (!dbFirestore) return res.status(404).json({ error: 'Db not connected' });
  const doc = await dbFirestore.collection('tests').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Test not found' });
  const test = { id: doc.id, ...doc.data() } as any;
  if (test.file_id && test.file_id.startsWith('/uploads/')) {
    test.image_url = test.file_id;
  } else {
    test.image_url = null;
  }
  res.json(test);
});

apiRouter.delete('/admin/tests/:id', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  await dbFirestore.collection('tests').doc(req.params.id).delete();
  res.json({ success: true });
});

apiRouter.put('/admin/tests/:id', upload.single('image'), async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const { correct_answer, text_content, option_a, option_b, option_c, option_d } = req.body;
  const file = req.file;
  const updateData: any = {};
  if (correct_answer) updateData.correct_answer = correct_answer;
  if (text_content !== undefined) updateData.text_content = text_content;
  if (option_a !== undefined) updateData.option_a = option_a;
  if (option_b !== undefined) updateData.option_b = option_b;
  if (option_c !== undefined) updateData.option_c = option_c;
  if (option_d !== undefined) updateData.option_d = option_d;
  if (file) {
    updateData.file_id = `/uploads/${file.filename}`;
  }
  await dbFirestore.collection('tests').doc(req.params.id).update(updateData);
  res.json({ success: true });
});

apiRouter.get('/admin/channels', async (req, res) => {
  if (!dbFirestore) return res.json([]);
  const snap = await dbFirestore.collection('channels').get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

apiRouter.post('/admin/channels', async (req, res) => {
  if (!dbFirestore) return res.json({});
  const { username } = req.body;
  const docRef = await dbFirestore.collection('channels').add({ username });
  res.json({ id: docRef.id, username });
});

apiRouter.delete('/admin/channels/:id', async (req, res) => {
  if (!dbFirestore) return res.json({});
  await dbFirestore.collection('channels').doc(req.params.id).delete();
  res.json({ success: true });
});

apiRouter.get('/admin/users', async (req, res) => {
  if (!dbFirestore) return res.json([]);
  const usersSnap = await dbFirestore.collection('users').get();
  res.json(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
});

apiRouter.delete('/admin/users/:id', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  await dbFirestore.collection('users').doc(req.params.id).delete();
  res.json({ success: true });
});

apiRouter.put('/admin/users/:id', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const { first_name, last_name, username, phone_number, is_admin, is_blocked } = req.body;
  try {
    const updateData: any = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (username !== undefined) updateData.username = username;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (is_admin !== undefined) updateData.is_admin = is_admin;
    if (is_blocked !== undefined) updateData.is_blocked = is_blocked;
    
    await dbFirestore.collection('users').doc(req.params.id).update(updateData);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: 'Xatolik yuz berdi' });
  }
});

apiRouter.get('/leaderboard', async (req, res) => {
  if (!dbFirestore) return res.json([]);
  const snap = await dbFirestore.collection('users').get();
  let users = snap.docs.map(d => d.data() as any).filter(u => u.total_tests > 0);
  users.sort((a, b) => {
    if (b.correct_answers !== a.correct_answers) return b.correct_answers - a.correct_answers;
    return a.time_spent - b.time_spent;
  });
  res.json(users.slice(0, 50));
});

apiRouter.get('/admin/stats', async (req, res) => {
  if (!dbFirestore) return res.json({});
  const usersSnap = await dbFirestore.collection('users').get();
  const testsSnap = await dbFirestore.collection('tests').get();
  
  let topUsers = usersSnap.docs.map(d => d.data() as any);
  topUsers.sort((a, b) => {
    if (b.correct_answers !== a.correct_answers) return (b.correct_answers || 0) - (a.correct_answers || 0);
    return (a.time_spent || 0) - (b.time_spent || 0);
  });
  
  res.json({
    totalUsers: usersSnap.size,
    totalTests: testsSnap.size,
    topUsers: topUsers.slice(0, 30)
  });
});

apiRouter.post('/admin/tests', upload.single('image'), async (req, res) => {
  if (!dbFirestore) return res.json({});
  try {
    const { correct_answer, text_content, option_a, option_b, option_c, option_d } = req.body;
    const file = req.file;
    if (!file && !text_content) {
      return res.status(400).json({ error: 'Image or text_content is required' });
    }
    if (!correct_answer) {
      return res.status(400).json({ error: 'correct_answer is required' });
    }
    const fileUrl = file ? `/uploads/${file.filename}` : null;
    
    let newTestId = '';
    await dbFirestore.runTransaction(async (t) => {
      const counterRef = dbFirestore!.collection('counters').doc('tests');
      const doc = await t.get(counterRef);
      let newId = 1;
      if (doc.exists) {
        newId = (doc.data() as any).count + 1;
        t.update(counterRef, { count: newId });
      } else {
        t.set(counterRef, { count: newId });
      }
      newTestId = newId.toString();
    });

    const testDoc = { 
      file_id: fileUrl, 
      text_content: text_content || null, 
      option_a: option_a || null,
      option_b: option_b || null,
      option_c: option_c || null,
      option_d: option_d || null,
      correct_answer, 
      created_at: Date.now() 
    };
    
    await dbFirestore.collection('tests').doc(newTestId).set(testDoc);
    
    res.json({ success: true, id: newTestId });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

apiRouter.post('/admin/export-users', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'Db not connected' });
  try {
    const usersSnap = await dbFirestore.collection('users').get();
    const users = usersSnap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        telegram_id: data.telegram_id,
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number,
        registered_at: new Date(data.registered_at || Date.now()).toLocaleString()
      };
    });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Foydalanuvchilar');
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 25 },
      { header: 'Telegram ID', key: 'telegram_id', width: 15 },
      { header: 'Ism', key: 'first_name', width: 20 },
      { header: 'Familiya', key: 'last_name', width: 20 },
      { header: 'Telefon', key: 'phone_number', width: 15 },
      { header: 'Sana', key: 'registered_at', width: 25 },
    ];
    users.forEach((u: any) => worksheet.addRow(u));
    const filePath = path.join(process.cwd(), 'users.xlsx');
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, 'foydalanuvchilar.xlsx', () => {
      fs.unlinkSync(filePath);
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Export failed' });
  }
});

apiRouter.get('/variants', async (req, res) => {
  if (!dbFirestore) return res.json([]);
  const snap = await dbFirestore.collection('variants').orderBy('created_at', 'desc').get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

apiRouter.post('/admin/variants', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  try {
    const { method, testIds } = req.body;
    
    let selectedIds: string[] = [];
    if (method === 'random') {
      const snap = await dbFirestore.collection('tests').get();
      let allTests = snap.docs.map(d => d.id);
      selectedIds = allTests.sort(() => 0.5 - Math.random()).slice(0, 10);
    } else if (method === 'manual') {
      selectedIds = testIds || [];
    }

    if (selectedIds.length === 0) return res.status(400).json({ error: 'No tests selected' });

    const snap = await dbFirestore.collection('variants').get();
    let maxNumber = 0;
    snap.docs.forEach(d => {
        const titleMatch = d.data()?.name?.match(/Variant (\d+)/i);
        if (titleMatch) {
            maxNumber = Math.max(maxNumber, parseInt(titleMatch[1]));
        }
    });
    
    const count = maxNumber + 1;
    const name = `Variant ${count}`;

    const variantData = {
      name,
      testIds: selectedIds,
      created_at: Date.now()
    };
    
    const docRef = await dbFirestore.collection('variants').add(variantData);
    res.json({ success: true, id: docRef.id, name });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

apiRouter.get('/admin/variants/:id/results', async (req, res) => {
  if (!dbFirestore) return res.status(500).json([]);
  try {
    const snap = await dbFirestore.collection('variant_results')
      .where('variant_id', '==', req.params.id)
      .orderBy('created_at', 'desc')
      .get();
    
    // We can also aggregate by telegram_id to keep the best or latest result if desired, but returning all is fine.
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Deduplicate by telegram_id to keep only the latest attempt
    const deduplicated = [];
    const seen = new Set();
    for (const r of results) {
       if (!seen.has(r.telegram_id)) {
          seen.add(r.telegram_id);
          deduplicated.push(r);
       }
    }
    
    res.json(deduplicated);
  } catch (e) {
    console.error(e);
    res.status(500).json([]);
  }
});

apiRouter.delete('/admin/variants/:id', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  await dbFirestore.collection('variants').doc(req.params.id).delete();
  res.json({ success: true });
});

apiRouter.put('/admin/variants/:id', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  const { name } = req.body;
  await dbFirestore.collection('variants').doc(req.params.id).update({ name });
  res.json({ success: true });
});

apiRouter.get('/variants/:id/tests', async (req, res) => {
  if (!dbFirestore) return res.status(500).json([]);
  try {
    const variantSnap = await dbFirestore.collection('variants').doc(req.params.id).get();
    if (!variantSnap.exists) return res.status(404).json({ error: 'Not found' });
    
    const data = variantSnap.data() as any;
    const testIds = data.testIds || [];
    
    if (testIds.length === 0) return res.json([]);
    
    const tests = [];
    for (const id of testIds) {
      const t = await dbFirestore.collection('tests').doc(id).get();
      if (t.exists) {
        const testData = t.data() as any;
        if (testData.file_id && testData.file_id.startsWith('/uploads/')) {
          testData.image_url = testData.file_id;
        } else {
          testData.image_url = null;
        }
        tests.push({ id: t.id, ...testData });
      }
    }
    
    res.json(tests);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

apiRouter.get('/videos', async (req, res) => {
  if (!dbFirestore) return res.json([]);
  try {
    const snap = await dbFirestore.collection('videos').orderBy('created_at', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

apiRouter.post('/admin/videos', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  try {
    const { title, url } = req.body;
    if (!title || !url) {
      return res.status(400).json({ error: 'Title and URL are required' });
    }
    
    // Extract video ID from youtube url if possible
    let videoId = '';
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.includes('youtube.com')) {
        videoId = parsedUrl.searchParams.get('v') || '';
      } else if (parsedUrl.hostname.includes('youtu.be')) {
        videoId = parsedUrl.pathname.slice(1);
      }
    } catch(e) {}

    const videoData = {
      title,
      url,
      videoId: videoId || url, // Store raw url if not youtube
      created_at: Date.now()
    };
    
    const docRef = await dbFirestore.collection('videos').add(videoData);
    res.json({ success: true, id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

apiRouter.delete('/admin/videos/:id', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  await dbFirestore.collection('videos').doc(req.params.id).delete();
  res.json({ success: true });
});

apiRouter.put('/admin/videos/:id', async (req, res) => {
  if (!dbFirestore) return res.status(500).json({ error: 'DB not connected' });
  try {
    const { title, url } = req.body;
    let videoId = '';
    
    if (url) {
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) {
          videoId = urlObj.searchParams.get('v') || '';
        } else if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.slice(1);
        }
      } catch (e) {}
    }

    const updateData: any = { title };
    if (url !== undefined) {
      updateData.url = url;
      updateData.videoId = videoId || url; // Fallback
    }

    await dbFirestore.collection('videos').doc(req.params.id).update(updateData);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
