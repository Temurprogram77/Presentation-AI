import { Telegraf } from 'telegraf';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import pptxgen from 'pptxgenjs';
import fs from 'fs';
import axios from 'axios';
import https from 'https';

dotenv.config({ path: path.resolve(process.cwd(), './.env') });

const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || process.env.TOKEN;

if (!token) {
    console.error("❌ Xatolik: .env faylida Telegram bot tokeni topilmadi!");
    process.exit(1);
}

// Telegraf — timeout va agent sozlamalari bilan (IPv4 majburiy)
const bot = new Telegraf(token, {
    handlerTimeout: 90_000,
    telegram: {
        agent: new https.Agent({ keepAlive: true, family: 4 }),
        attachmentAgent: new https.Agent({ keepAlive: true, family: 4 })
    }
});

const client = new OpenAI({
    baseURL: "https://ai.megallm.io/v1",
    apiKey: process.env.MEGALLM_API_KEY
});

// Rasmni vaqtinchalik yuklab olish funksiyasi
async function downloadImage(url, filepath) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// /start buyrug'i
bot.start((ctx) => {
    const baseUrl = process.env.WEBAPP_URL || 'http://localhost:5173';
    const chatId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Ustoz';
    const webAppUrl = `${baseUrl}?chatId=${chatId}`;

    ctx.reply(
        `👋 Salom, ${firstName}!\n\n` +
        `📊 <b>Presentation AI</b> — dars taqdimotlarini sekundlar ichida yaratib beradigan aqlli yordamchingiz.\n\n` +
        `✅ Faqat mavzuni yozing — qolganini AI qiladi:\n` +
        `• Professional slaydlar\n` +
        `• Mos kontent va strukturа\n` +
        `• Tayyor PPTX fayl — shu yerga yuboriladi\n\n` +
        `⬇️ Boshlash uchun tugmani bosing:`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🚀 Taqdimot yaratish", web_app: { url: webAppUrl } }]
                ]
            }
        }
    );
});


// Matnli xabarlarni ushlash
bot.on('text', async (ctx) => {
    const topic = ctx.message.text.trim();
    if (topic.startsWith('/')) return;

    const loadingMessage = await ctx.reply('🔄 Sun\'iy intellekt slayd kontentini tayyorlamoqda...');

    try {
        const response = await client.chat.completions.create({
            model: "deepseek-ai/deepseek-v3.1",
            messages: [
                {
                    role: "system",
                    content: "Sen maktab darslari uchun faqat qat'iy JSON formatida javob beradigan yordamchisan. Hech qanday markdown teglari yoki tushuntirish qo'shma."
                },
                {
                    role: "user",
                    content: `Mavzu: "${topic}". 5 ta slayd uchun kontent tayyorla. Har bir slayd uchun qisqa inglizcha qidiruv so'zi (keyword) ham ber, shu so'z orqali slaydga rasm topamiz. Har bir punkt maksimal 5-7 ta so'zdan iborat bo'lsin. Javob aynan mana shu formatda bo'lsin: [{"title": "Sarlavha", "bullets": ["1-punkt", "2-punkt"], "keyword": "inglizcha qidiruv so'zi"}]`
                }
            ],
            max_tokens: 1000
        });

        let rawContent = response.choices[0].message.content.trim();
        if (rawContent.startsWith("```")) {
            rawContent = rawContent.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }

        const slidesData = JSON.parse(rawContent);

        await ctx.telegram.editMessageText(
            ctx.chat.id, 
            loadingMessage.message_id, 
            null, 
            '🎨 Kontent tayyor! Mavzuga mos rasmlar yuklanmoqda va slayd dizayni shakllantirilmoqda...'
        );

        let pptx = new pptxgen();
        pptx.layout = 'LAYOUT_16x9';

        for (let i = 0; i < slidesData.length; i++) {
            const slideData = slidesData[i];
            let slide = pptx.addSlide();
            
            slide.background = { fill: "F8F9FA" };

            // Pastki qismdagi ko'k chiziq (Dizayn)
            slide.addShape(pptx.ShapeType.rect, {
                x: 0, y: 7.0, w: "100%", h: 0.5,
                fill: { color: "1E3A8A" }
            });

            // Sarlavha
            slide.addText(slideData.title, { 
                x: 0.6, y: 0.5, w: "55%", h: 0.8, 
                fontSize: 24, bold: true, color: "1E3A8A",
                fontFace: "Arial"
            });
            
            // Punktlar
            const bodyText = slideData.bullets.join('\n\n');
            slide.addText(bodyText, { 
                x: 0.6, y: 1.6, w: "55%", h: 4.8, 
                fontSize: 15, color: "334155", 
                bullet: { type: 'number' },
                fontFace: "Arial",
                lineSpacing: 20
            });

            // Rasmlarni yuklab olish ramkasi
            const imgFilename = `temp_img_${Date.now()}_${i}.jpg`;
            const searchKeyword = slideData.keyword || "education";
            const defaultImgUrl = `https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=600&auto=format&fit=crop`;
            const dynamicImageUrl = `https://loremflickr.com/600/450/${encodeURIComponent(searchKeyword)}`;

            try {
                await downloadImage(dynamicImageUrl, imgFilename);
            } catch (imgErr) {
                try {
                    await downloadImage(defaultImgUrl, imgFilename);
                } catch(e) {}
            }

            if (fs.existsSync(imgFilename)) {
                slide.addImage({
                    path: imgFilename,
                    x: 6.5, y: 0.8, w: 6.3, h: 4.8
                });
                setTimeout(() => { try { fs.unlinkSync(imgFilename); } catch(e){} }, 5000);
            }
        }

        const fileName = `${Date.now()}_taqdimot.pptx`;
        await pptx.writeFile({ fileName: fileName });

        await ctx.replyWithDocument({ 
            source: fileName, 
            filename: `${topic.replace(/\s+/g, '_')}_taqdimot.pptx` 
        });

        fs.unlinkSync(fileName);
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);

    } catch (error) {
        console.error("Botda xatolik:", error);
        await ctx.telegram.editMessageText(
            ctx.chat.id, 
            loadingMessage.message_id, 
            null, 
            `❌ Xatolik yuz berdi: ${error.message}`
        );
    }
});

bot.launch().then(() => {
    console.log('🤖 Web App qo\'llab-quvvatlaydigan bot ishga tushdi...');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));