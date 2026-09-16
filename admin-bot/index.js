import { Telegraf } from 'telegraf';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env faylini yuklaymiz (bitta yuqoridagi papkadan)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const botToken = process.env.ADMIN_BOT_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!botToken) {
    console.error("XATOLIK: ADMIN_BOT_TOKEN mavjud emas!");
    process.exit(1);
}

if (!geminiApiKey) {
    console.error("XATOLIK: GEMINI_API_KEY mavjud emas!");
    process.exit(1);
}

const bot = new Telegraf(botToken);
const genAI = new GoogleGenerativeAI(geminiApiKey);

const SYSTEM_PROMPT = `Sen Presentation AI loyihasining rasmiy Admin (yordamchi) botisan. Yaratuvching: Temurbek Narzullayev.
Vazifang: Foydalanuvchilarning barcha savollariga, ayniqsa bot, uning yaratuvchisi (Temurbek Narzullayev) yoki loyiha xaqidagi qo'shimcha savollarga to'liq, tushunarli va xushmuomalalik bilan javob berish.
Shuningdek, ixtiyoriy boshqa mavzularda ham bemalol gaplashishing va yordam berishing mumkin.
Javobing toza va chiroyli bo'lishi kerak.`;

bot.start((ctx) => {
    const name = ctx.from.first_name || 'Foydalanuvchi';
    ctx.reply(`Assalomu alaykum, ${name}! 👋\n\nMen Presentation AI loyihasining maxsus yordamchi botiman. \nBemalol savollaringizni yozsangiz bo'ladi, men bajonidil javob beraman! 😊`);
});

bot.on('text', async (ctx) => {
    const userMessage = ctx.message.text;
    
    // Foydalanuvchi "start" yuborgan bo'lishi mumkin
    if (userMessage.startsWith('/start')) return;

    const msg = await ctx.reply("⏳ Javob tayyorlanmoqda, iltimos kuting...");

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nFoydalanuvchi: ${userMessage}\nAdmin Bot (Sen):`);
        const responseText = result.response.text();
        
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, responseText);
    } catch (error) {
        console.error("Gemini API xatosi:", error);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, "Kechirasiz, tizimda vaqtinchalik uzilish yuz berdi. Iltimos keyinroq qayta urinib ko'ring.");
    }
});

bot.launch().then(() => {
    console.log("✅ Admin Bot muvaffaqiyatli ishga tushdi!");
}).catch((err) => {
    console.error("❌ Botni ishga tushirishda xato:", err);
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
