const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const prism = require('prism-media');
const wav = require('wav');
const ffmpeg = require('fluent-ffmpeg');
const googleTTS = require('google-tts-api');
const { google } = require('googleapis');
const dotenv = require('dotenv');
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

let activeStreams = new Set();
let wavWriter = null;
let userOutputFile = null;
let outputPath = null;

client.once('ready', () => {
    console.log('✅ Bot is ready!');
});

client.on('messageCreate', async (message) => {
    const command = message.content.toLowerCase();

    if (command === '!join') {
        const channel = message.member.voice.channel;
        if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');

        // ตรวจสอบว่าบอทอยู่ในห้องแล้วหรือยัง
        const existingConnection = getVoiceConnection(channel.guild.id);
        if (existingConnection) {
            return message.reply('✅ บอทอยู่ในห้องแล้ว!');
        }

        // ถ้าบอทยังไม่ได้อยู่ในห้อง ให้เข้าห้อง
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
        if (!channel) return message.reply('นี้คือการอธิบายการใช้งาน!');
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        speak(connection, "นี้คือการอธิบายการใช้งาน!");
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
        if (!channel) return message.reply('อะไรเกิดก่อนไดโนเสาร์ นั้นคือ ไดโนศุกร์ไง!');
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        speak(connection, "อะไรเกิดก่อนไดโนเสาร์ นั้นคือ ไดโนศุกร์ไง!");
    }
    if (command === '!record') {
        const channel = message.member.voice.channel;
        if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');

        const connection = getVoiceConnection(channel.guild.id);
        if (!connection) return message.reply('❌ บอทยังไม่ได้เข้าห้องเสียง! ใช้ `!join` ก่อน');

        const receiver = connection.receiver;
        receiver.speaking.setMaxListeners(0);

        outputPath = `combined_recording_${Date.now()}.wav`;
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
            activeStreams.add(userId);

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
                console.error(`❌ เกิดข้อผิดพลาดในการรับข้อมูลเสียงจาก ${userId}:`, err);
                audioReceiver.destroy();
                activeStreams.delete(userId);
            });
        });

        message.reply(`🎙️ กำลังบันทึกเสียงรวมทุกคน! ใช้ \`!stop\` เพื่อหยุด`);
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
                receiver.speaking.removeAllListeners('start');
            }
            connection.destroy();
        }

        if (wavWriter) {
            wavWriter.end();
            userOutputFile.end();
        }

        activeStreams.clear();
        console.log('✅ บันทึกไฟล์ WAV เสร็จสิ้น');

        if (outputPath) {
            const mergedOutputPath = `merged_${outputPath}`;
        
            await mergeAudioFiles([outputPath], mergedOutputPath);
        
            try {
                message.reply('📝 กำลังอัปโหลดและถอดเสียง กรุณารอสักครู่...');
                const fileLink = await uploadToGoogleDrive(mergedOutputPath);
                message.channel.send(`🔗 ดาวน์โหลดไฟล์เสียงจาก Google Drive: ${fileLink}`);
                const transcription = await transcribeAudio(mergedOutputPath);
                message.channel.send(`📜 ถอดเสียง:\n\`\`\`${transcription}\`\`\``);

                // Upload the merged audio file to Google Drive
            } catch (error) {
                console.error('❌ เกิดข้อผิดพลาดในการถอดเสียง:', error);
                message.reply('❌ ไม่สามารถถอดเสียงได้');
            }
        } else {
            message.reply('❌ ไม่พบไฟล์ที่บันทึก!');
        }
        
    }
});

// ฟังก์ชันให้บอทพูดด้วยเสียง TTS
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

async function transcribeAudio(filePath) {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));

    try {
        const response = await axios.post("http://localhost:8000/transcribe/", formData, {
            headers: {
                ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        console.log("Transcription:", response.data.text);
        return response.data.text;
    } catch (error) {
        console.error("Error transcribing audio:", error);
    }
}

async function mergeAudioFiles(inputFiles, outputFile) {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(inputFiles[0]) // ใช้ไฟล์ WAV ที่บันทึก
            .audioCodec('pcm_s16le') // ตั้งค่า codec ของเสียง
            .on('end', () => {
                console.log('✅ รวมไฟล์เสียงเสร็จสิ้น');
                resolve();
            })
            .on('error', (err) => {
                console.error('❌ เกิดข้อผิดพลาดในการรวมไฟล์:', err);
                reject(err);
            })
            .save(outputFile);
    });
}

// ฟังก์ชันอัปโหลดไฟล์ไปยัง Google Drive
async function uploadToGoogleDrive(filePath) {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'key.json', // เส้นทางไปยังไฟล์คีย์บริการ
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
        name: `audio_${Date.now()}.wav`, // ชื่อไฟล์ที่จะแสดงใน Google Drive
        mimeType: 'audio/wav',
    };

    const media = {
        mimeType: 'audio/wav',
        body: fs.createReadStream(filePath),
    };

    try {
        // อัปโหลดไฟล์ไปยัง Google Drive
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });

        const fileId = response.data.id;

        // เปลี่ยนการตั้งค่าการเข้าถึงไฟล์ให้เป็นสาธารณะ
        await drive.permissions.create({
            fileId: fileId,
            resource: {
                role: 'reader', 
                type: 'anyone', 
            },
        });

        const fileLink = `https://drive.google.com/file/d/${fileId}/view`;
        return fileLink;
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการอัปโหลดไฟล์ไปยัง Google Drive:', error);
        throw error;
    }
}
async function  random_num() {
 let food = ['ผัก', 'ข้าวผัด', 'ต้มยำกุ้ง', 'แกงเขียวหวาน', 'ก๋วยเตี๋ยว', 'ส้มตำ', 'หมูกระทะ', 'ข้าวมันไก่', 'ปูผัดผงกะหรี่', 'ไก่ทอด'];
    return food[Math.floor(Math.random() * food)];
}
client.login(process.env.TOKEN);

