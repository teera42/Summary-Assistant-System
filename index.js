const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');
const prism = require('prism-media');
const wav = require('wav');
const googleTTS = require('google-tts-api');
const dotenv = require('dotenv');
const axios = require('axios');
const { google } = require('googleapis');
const FormData = require('form-data');

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

let activeStreams = new Map();
let outputPath = null;
let wavWriter = null;
let userOutputFile = null;
const recordedMembers = new Set();
client.once('ready', () => {
    console.log('✅ Bot is ready!');
});

client.on('messageCreate', async (message) => {
    const command = message.content.toLowerCase();

    if (command === '!join') {
        const channel = message.member.voice.channel;
        if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        message.reply('✅ บอทเข้าห้องเสียงแล้ว! ใช้ `!record` เพื่อเริ่มบันทึกเสียง');
        speak(connection, "บอทเข้าห้องแล้ว!");
    }
    if(command === '!randomfood'){
        const channel = message.member.voice.channel;
        const random_food_res = random_food(); // ไม่ต้องใช้ await เพราะเป็นฟังก์ชันปกติ
        const textResponse = `อาหารที่สุ่มได้ คือ... 🎺 ${random_food_res} นั่นเอง!`;
        if (!channel) return message.reply( textResponse);
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        speak(connection, textResponse);
        }
    if(command === '!guide'){
        const channel = message.member.voice.channel;
        if (!channel) return message.reply('นี้คือการอธิบายการใช้งาน!');
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        speak(connection, "นี้คือการอธิบายการใช้งาน!");
    }
    if(command === '!joke'){
        const channel = message.member.voice.channel;
        if (!channel) return message.reply('ฉันแนะนำมุกตลกนี้ อะไรเกิดก่อนไดโนเสาร์ คำตอบ ไดโนศุกร์ไง 5555!');
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        speak(connection, "ฉันแนะนำมุกตลกนี้ อะไรเกิดก่อนไดโนเสาร์ คำตอบ ไดโนศุกร์ไง 5555!");
    }
    if (command === '!participants') {
        const channel = message.member.voice.channel;
        if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');
    
        const members = channel.members.map(member => member.displayName).join(', ');
    
        if (!members) return message.reply('❌ ไม่มีสมาชิกอยู่ในห้องเสียง');
    
        message.reply(`👥 ผู้เข้าร่วมประชุม: ${members}`);
    }
    
    if (command === '!record') {
        const channel = message.member.voice.channel;
         if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');

        let connection = getVoiceConnection(channel.guild.id);
    
    // ถ้าบอทยังไม่อยู่ในห้อง ให้ใช้ !join ก่อน
        if (!connection) {
            message.reply('❌ บอทยังไม่ได้เข้าห้องเสียง! ใช้ `!join` ก่อน');
            return;
        }

        const receiver = connection.receiver;
        recordedMembers.clear();
        receiver.speaking.setMaxListeners(0);
        channel.members.forEach(member => {
            recordedMembers.add(member.displayName);
        });
        outputPath = `./recordings/recording_${Date.now()}.wav`;
        userOutputFile = fs.createWriteStream(outputPath, { highWaterMark: 1024 * 1024 });
        wavWriter = new wav.Writer({
            sampleRate: 48000,
            channels: 2,
            bitDepth: 16
        });

        wavWriter.pipe(userOutputFile);

        receiver.speaking.on('start', (userId) => {
            if (activeStreams.has(userId)) return;
            console.log(`${userId} กำลังพูด`);
            activeStreams.set(userId, true);

            const audioReceiver = receiver.subscribe(userId, {
                end: { behavior: 'silence' }
            });

            const decoder = new prism.opus.Decoder({
                rate: 48000,
                channels: 2,
                frameSize: 1920
            });

            audioReceiver.pipe(decoder).pipe(wavWriter, { end: false });

            audioReceiver.once('end', () => {
                console.log(`📢 เสียงจาก ${userId} สิ้นสุดแล้ว`);
                activeStreams.delete(userId);
            });

            audioReceiver.once('error', (err) => {
                console.error(`❌ ข้อผิดพลาดจาก ${userId}:`, err);
                audioReceiver.destroy();
                activeStreams.delete(userId);
            });
        });

        message.reply('🎙️ กำลังบันทึกเสียง! ใช้ `!stop` เพื่อหยุด');
        speak(connection, "เริ่มบันทึกเสียงแล้ว");
    }

    if (command === '!stop') {
        if (activeStreams.size === 0) {
            return message.reply('❌ บอทยังไม่ได้เริ่มบันทึกเสียง! ใช้ `!record` ก่อน');
        }
    
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            const receiver = connection.receiver;
            if (receiver) {
                receiver.speaking.removeAllListeners('start'); // ลบ event listener ของ speaking
            }
            connection.destroy(); // ออกจากห้องเสียง
        }
    
        if (wavWriter) {
            wavWriter.end();
            userOutputFile.end();
        }

    
        activeStreams.clear();
        console.log('✅ บันทึกไฟล์ WAV เสร็จสิ้น');
    
        if (outputPath) {
            try {
                message.reply('📝 กำลังอัปโหลดและถอดเสียง กรุณารอสักครู่...');
                const fileLink = await uploadToGoogleDrive(outputPath);
                message.channel.send(`🔗 ดาวน์โหลดไฟล์เสียงจาก Google Drive: ${fileLink}`);
                
                const transcription = await transcribeAudio(outputPath);
                message.channel.send(`📜 ถอดเสียง:\n\`\`\`${transcription}\`\`\``);
                const summary = await summarizeText(transcription,recordedMembers);
                message.channel.send(`📑 สรุปเนื้อหาการประชุม:\n\`\`\`${summary}\`\`\``);
                recordedMembers.clear;
            } catch (error) {
                console.error('❌ เกิดข้อผิดพลาดในการถอดเสียง:', error);
                message.reply('❌ ไม่สามารถถอดเสียงได้');
            }
        } else {
            message.reply('❌ ไม่พบไฟล์ที่บันทึก!');
        }
    }
    
});
client.on('voiceStateUpdate', (oldState, newState) => {
    const member = newState.member || oldState.member; 
    if (!member) return; 

    const displayName = member.displayName; 
    const newChannel = newState.channel;

    if (newChannel && !recordedMembers.has(displayName)) {
        recordedMembers.add(displayName);
    }
});


client.login(process.env.TOKEN);

async function speak(connection, text) {
    const url = googleTTS.getAudioUrl(text, {
        lang: 'th',
        slow: false,
        host: 'https://translate.google.com',
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(url);

    player.play(resource);
    connection.subscribe(player);
}
function random_food() {
    const food = [
        'ผัดกะเพรา', 'ข้าวผัด', 'ต้มยำกุ้ง', 'แกงเขียวหวาน', 'ก๋วยเตี๋ยว',
        'ส้มตำ', 'หมูกระทะ', 'ข้าวมันไก่', 'ปูผัดผงกะหรี่', 'ไก่ทอด',
        'ข้าวขาหมู', 'ยำวุ้นเส้น', 'แกงส้ม', 'หมูทอดกระเทียม', 'ไข่เจียวหมูสับ'
    ];
    return food[Math.floor(Math.random() * food.length)];
}
async function uploadToGoogleDrive(filePath) {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'key.json',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
        name: `record_${Date.now()}.wav`,
        mimeType: 'audio/wav',
    };

    const media = {
        mimeType: 'audio/wav',
        body: fs.createReadStream(filePath),
    };

    try {
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });

        const fileId = response.data.id;

        await drive.permissions.create({
            fileId: fileId,
            resource: {
                role: 'reader',
                type: 'anyone',
            },
        });

        return `https://drive.google.com/file/d/${fileId}/view`;
    } catch (error) {
        console.error('❌ อัปโหลดไฟล์ล้มเหลว:', error);
        throw error;
    }
}

async function transcribeAudio(filePath) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("❌ ไม่พบ API Key ของ OpenAI");
        }
        const formData = new FormData();
        formData.append("file", fs.createReadStream(filePath));
        formData.append("model", "whisper-1");

        const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
            headers: {
                ...formData.getHeaders(),
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
                         maxContentLength: Infinity,
                        maxBodyLength: Infinity,
        });

        return response.data.text;
    } catch (error) {
        console.error("❌ การถอดเสียงล้มเหลว:", error.response?.data || error.message);
        return "";
    }
}

async function summarizeText(text, recordedMembers) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("❌ ไม่พบ API Key ของ OpenAI");
        }

        recordedMembers = recordedMembers || "ไม่ระบุ";

        const prompt = `
สรุปการประชุมจากข้อความถอดเสียงต่อไปนี้ในรูปแบบที่กำหนด:

📅 วันที่ประชุม: [ระบุวันที่จากเนื้อหา หรือใช้ 'ไม่ระบุ']
📝 หัวข้อประชุม: [สรุปหัวข้อประชุม]
👥 ผู้เข้าร่วมประชุม:
[สรุปรายชื่อและตำแหน่งผู้เข้าร่วมประชุม]

📌 เนื้อหาการประชุม:
✅ งานที่เสร็จแล้ว:
[สรุปงานที่ดำเนินการเสร็จ]

⚠ ปัญหาที่พบ:
[สรุปปัญหาที่พบ]

🎯 แผนงานถัดไป:
[สิ่งที่ต้องดำเนินการต่อไป]

✍ มติที่ประชุม:
[ข้อสรุป หรือการตัดสินใจที่ได้จากการประชุม]

📢 หมายเหตุเพิ่มเติม:
[ข้อมูลอื่น ๆ ที่สำคัญ เช่น วันประชุมครั้งถัดไป]
`;

        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4o-mini",
                messages: [
                    { "role": "system", "content": `ช่วยสรุปการประชุมในรูปแบบนี้: ${prompt}` },
                    { "role": "user", "content": `เนื้อหา :${text} รายชื่อคนเข้าประชุม : ${recordedMembers}` }
                ],
                temperature: 0.7,
                max_tokens: 1024,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const result = response.data.choices?.[0]?.message?.content || "❌ ไม่สามารถสรุปข้อความได้";
        return result;

    } catch (error) {
        console.error("❌ สรุปข้อความล้มเหลว:", error.response?.data || error.message);
        return "ไม่สามารถสรุปข้อความได้";
    }
}
