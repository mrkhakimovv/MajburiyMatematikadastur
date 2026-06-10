import TelegramBot from 'node-telegram-bot-api';
import db from './db.ts';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("XATO: BOT_TOKEN topilmadi. Iltimos, .env.local faylini yarating va BOT_TOKEN ni kiriting.");
  // Dasturni to'xtatish (development uchun qulay, lekin serverda crash beradi)
  // throw new Error("BOT_TOKEN is required!");
}

const ADMIN_ID = process.env.ADMIN_ID || '1986422890';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export const bot = new TelegramBot(token || 'dummy_token', { polling: !!token });

if (token) {
  // Prevent bot crashes due to polling conflicts (e.g., in multi-instance Cloud Run environments)
  bot.on('polling_error', (error) => {
    console.warn(`[Bot Polling Warning] ${error.message}`);
  });
}

export function setState(telegramId: string, state: string, data: any = {}) {
  db.prepare('INSERT OR REPLACE INTO bot_state (telegram_id, state, data) VALUES (?, ?, ?)').run(telegramId, state, JSON.stringify(data));
}

export function getState(telegramId: string) {
  const row = db.prepare('SELECT state, data FROM bot_state WHERE telegram_id = ?').get(telegramId) as any;
  if (row) {
    return { state: row.state, data: JSON.parse(row.data) };
  }
  return null;
}

export function clearState(telegramId: string) {
  db.prepare('DELETE FROM bot_state WHERE telegram_id = ?').run(telegramId);
}

async function checkChannels(userId: number) {
  const channels = db.prepare('SELECT username FROM channels').all() as any[];
  const notSubscribed = [];
  for (const ch of channels) {
    try {
      const chatMember = await bot.getChatMember(ch.username, userId);
      if (chatMember.status === 'left' || chatMember.status === 'kicked') {
        notSubscribed.push(ch.username);
      }
    } catch (e) {
      notSubscribed.push(ch.username);
    }
  }
  return notSubscribed;
}

export function initBot() {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    if (!userId) return;

    if (userId.toString() === ADMIN_ID) {
      bot.sendMessage(chatId, 'Assalomu alaykum, Admin! Boshqaruv paneliga kirish uchun quyidagi tugmani bosing.', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Kirish', web_app: { url: APP_URL } }]]
        }
      });
      return;
    }

    const notSubscribed = await checkChannels(userId);
    if (notSubscribed.length > 0) {
      const buttons: any[] = notSubscribed.map(ch => ([{ text: ch, url: `https://t.me/${ch.replace('@', '')}` }]));
      buttons.push([{ text: 'Tekshirish', callback_data: 'check_subs' }]);
      bot.sendMessage(chatId, "Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:", {
        reply_markup: { inline_keyboard: buttons }
      });
      return;
    }

    startRegistration(chatId, userId.toString());
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    if (!chatId) return;

    if (query.data === 'check_subs') {
      const notSubscribed = await checkChannels(userId);
      if (notSubscribed.length > 0) {
        bot.answerCallbackQuery(query.id, { text: "Hali barcha kanallarga obuna bo'lmagansiz!", show_alert: true });
      } else {
        bot.answerCallbackQuery(query.id, { text: 'Obuna tasdiqlandi!' });
        bot.deleteMessage(chatId, query.message!.message_id);
        startRegistration(chatId, userId.toString());
      }
    } else if (query.data?.startsWith('test_ans_')) {
      const ans = query.data.split('_')[2];
      const state = getState(userId.toString());
      if (state && state.state === 'WAITING_FOR_TEST_ANSWER') {
        const fileId = state.data.fileId;
        const info = db.prepare('INSERT INTO tests (file_id, correct_answer) VALUES (?, ?)').run(fileId, ans);
        bot.sendMessage(chatId, `Test bazaga saqlandi. ID: ${info.lastInsertRowid}`);
        clearState(userId.toString());
        bot.deleteMessage(chatId, query.message!.message_id);
      }
    } else if (query.data === 'broadcast_yes') {
      const state = getState(userId.toString());
      if (state && state.state === 'WAITING_FOR_BROADCAST_CONFIRM') {
        const msgId = state.data.messageId;
        const users = db.prepare('SELECT telegram_id FROM users').all() as any[];
        let count = 0;
        bot.sendMessage(chatId, 'Reklama yuborilmoqda...');
        for (const u of users) {
          try {
            await bot.copyMessage(u.telegram_id, chatId, msgId);
            count++;
          } catch (e) {}
        }
        bot.sendMessage(chatId, `Reklama ${count} ta foydalanuvchiga muvaffaqiyatli yuborildi.`);
        clearState(userId.toString());
      }
    } else if (query.data === 'broadcast_no') {
      bot.sendMessage(chatId, 'Reklama yuborish bekor qilindi.');
      clearState(userId.toString());
    }
  });

  function startRegistration(chatId: number, telegramId: string) {
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    if (user) {
      sendUserPanel(chatId);
    } else {
      // Automatically register with a default name
      const defaultFirstName = `Foydalanuvchi`;
      const defaultLastName = `${telegramId.slice(-4)}`; // e.g., Foydalanuvchi 1234
      
      const info = db.prepare('INSERT INTO users (telegram_id, first_name, last_name, phone_number) VALUES (?, ?, ?, ?)').run(telegramId, defaultFirstName, defaultLastName, '');
      db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').run(info.lastInsertRowid);
      
      bot.sendMessage(chatId, "Ro'yxatdan muvaffaqiyatli o'tdingiz! Ismingizni Web App ichidagi Profil bo'limidan o'zgartirishingiz mumkin.");
      sendUserPanel(chatId);
    }
  }

  function sendUserPanel(chatId: number) {
    bot.sendMessage(chatId, 'Asosiy menyu. Test ishlash uchun quyidagi tugmani bosing:', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Test ishlash', web_app: { url: APP_URL } }]]
      }
    });
  }

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    if (!userId) return;

    if (msg.text === '/users' && userId === ADMIN_ID) {
      await sendUsersExcel(chatId);
      return;
    }

    const stateObj = getState(userId);
    if (!stateObj) return;

    const { state, data } = stateObj;

    if (state === 'WAITING_FOR_TEST_PHOTO' && msg.photo) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      setState(userId, 'WAITING_FOR_TEST_ANSWER', { fileId });
      bot.sendMessage(chatId, "To'g'ri javobni belgilang:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'A', callback_data: 'test_ans_A' }, { text: 'B', callback_data: 'test_ans_B' }],
            [{ text: 'C', callback_data: 'test_ans_C' }, { text: 'D', callback_data: 'test_ans_D' }]
          ]
        }
      });
    } else if (state === 'WAITING_FOR_BROADCAST_MESSAGE') {
      setState(userId, 'WAITING_FOR_BROADCAST_CONFIRM', { messageId: msg.message_id });
      bot.sendMessage(chatId, 'Ushbu xabarni barcha foydalanuvchilarga yuborishni tasdiqlaysizmi?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Ha', callback_data: 'broadcast_yes' }, { text: "Yo'q", callback_data: 'broadcast_no' }]
          ]
        }
      });
    }
  });
}

export async function sendUsersExcel(chatId: number) {
  const users = db.prepare('SELECT * FROM users').all() as any[];
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Foydalanuvchilar');
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Telegram ID', key: 'telegram_id', width: 15 },
    { header: 'Ism', key: 'first_name', width: 20 },
    { header: 'Familiya', key: 'last_name', width: 20 },
    { header: 'Telefon', key: 'phone_number', width: 15 },
    { header: 'Sana', key: 'registered_at', width: 20 },
  ];
  users.forEach(u => worksheet.addRow(u));
  const filePath = path.join(process.cwd(), 'users.xlsx');
  await workbook.xlsx.writeFile(filePath);
  await bot.sendDocument(chatId, filePath);
  fs.unlinkSync(filePath);
}
