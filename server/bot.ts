import TelegramBot from 'node-telegram-bot-api';
import { dbFirestore } from './firebase.ts';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("XATO: BOT_TOKEN topilmadi. Iltimos, .env.local faylini yarating va BOT_TOKEN ni kiriting.");
}

const ADMIN_ID = process.env.ADMIN_ID || '1986422890';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export const bot = new TelegramBot(token || 'dummy_token', { polling: !!token });

if (token) {
  bot.on('polling_error', (error) => {
    console.warn(`[Bot Polling Warning] ${error.message}`);
  });
}

export async function setState(telegramId: string, state: string, data: any = {}) {
  if (!dbFirestore) return;
  try {
    await dbFirestore.collection('bot_states').doc(telegramId).set({
      state,
      data: JSON.stringify(data)
    });
  } catch (e: any) {
    if (e.code === 7) console.error("Firebase permission denied. Missing Service Account.");
  }
}

export async function getState(telegramId: string) {
  if (!dbFirestore) return null;
  try {
    const doc = await dbFirestore.collection('bot_states').doc(telegramId).get();
    if (doc.exists) {
      const data = doc.data() as any;
      return { state: data.state, data: JSON.parse(data.data || '{}') };
    }
  } catch (e: any) {
    if (e.code === 7) console.error("Firebase permission denied. Missing Service Account.");
  }
  return null;
}

export async function clearState(telegramId: string) {
  if (!dbFirestore) return;
  try {
    await dbFirestore.collection('bot_states').doc(telegramId).delete();
  } catch (e: any) {
    if (e.code === 7) console.error("Firebase permission denied. Missing Service Account.");
  }
}

async function checkChannels(userId: number) {
  if (!dbFirestore) return [];
  try {
    const snapshot = await dbFirestore.collection('channels').get();
    const notSubscribed: string[] = [];
    for (const doc of snapshot.docs) {
      const ch = doc.data();
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
  } catch (e: any) {
    if (e.code === 7) console.error("Firebase permission denied. Missing Service Account.");
    return [];
  }
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

    await startRegistration(chatId, userId.toString());
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
        await startRegistration(chatId, userId.toString());
      }
    } else if (query.data?.startsWith('test_ans_')) {
      const ans = query.data.split('_')[2];
      const stateObj = await getState(userId.toString());
      if (stateObj && stateObj.state === 'WAITING_FOR_TEST_ANSWER' && dbFirestore) {
        const fileId = stateObj.data.fileId;
        const testRef = await dbFirestore.collection('tests').add({
          file_id: fileId,
          correct_answer: ans,
          created_at: Date.now()
        });
        bot.sendMessage(chatId, `Test bazaga saqlandi. ID: ${testRef.id}`);
        await clearState(userId.toString());
        bot.deleteMessage(chatId, query.message!.message_id);
      }
    } else if (query.data === 'broadcast_yes') {
      const stateObj = await getState(userId.toString());
      if (stateObj && stateObj.state === 'WAITING_FOR_BROADCAST_CONFIRM' && dbFirestore) {
        const msgId = stateObj.data.messageId;
        const usersSnap = await dbFirestore.collection('users').get();
        let count = 0;
        bot.sendMessage(chatId, 'Reklama yuborilmoqda...');
        for (const doc of usersSnap.docs) {
          try {
            await bot.copyMessage(doc.id, chatId, msgId);
            count++;
          } catch (e) {}
        }
        bot.sendMessage(chatId, `Reklama ${count} ta foydalanuvchiga muvaffaqiyatli yuborildi.`);
        await clearState(userId.toString());
      }
    } else if (query.data === 'broadcast_no') {
      bot.sendMessage(chatId, 'Reklama yuborish bekor qilindi.');
      await clearState(userId.toString());
    }
  });

  async function startRegistration(chatId: number, telegramId: string) {
    if (!dbFirestore) return;
    const userDoc = await dbFirestore.collection('users').doc(telegramId).get();
    if (userDoc.exists) {
      sendUserPanel(chatId);
    } else {
      const defaultFirstName = `Foydalanuvchi`;
      const defaultLastName = `${telegramId.slice(-4)}`;
      
      await dbFirestore.collection('users').doc(telegramId).set({
        telegram_id: telegramId,
        first_name: defaultFirstName,
        last_name: defaultLastName,
        username: `@user_${telegramId}`,
        phone_number: '',
        registered_at: Date.now(),
        total_tests: 0,
        correct_answers: 0,
        wrong_answers: 0,
        time_spent: 0
      });
      
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

    const stateObj = await getState(userId);
    if (!stateObj) return;

    const { state, data } = stateObj;

    if (state === 'WAITING_FOR_TEST_PHOTO' && msg.photo) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      await setState(userId, 'WAITING_FOR_TEST_ANSWER', { fileId });
      bot.sendMessage(chatId, "To'g'ri javobni belgilang:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'A', callback_data: 'test_ans_A' }, { text: 'B', callback_data: 'test_ans_B' }],
            [{ text: 'C', callback_data: 'test_ans_C' }, { text: 'D', callback_data: 'test_ans_D' }]
          ]
        }
      });
    } else if (state === 'WAITING_FOR_BROADCAST_MESSAGE') {
      await setState(userId, 'WAITING_FOR_BROADCAST_CONFIRM', { messageId: msg.message_id });
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
  if (!dbFirestore) return;
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
    await bot.sendDocument(chatId, filePath);
    fs.unlinkSync(filePath);
  } catch (e: any) {
    if (e.code === 7) console.error("Firebase permission denied. Missing Service Account.");
  }
}
