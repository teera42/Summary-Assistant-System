// const { Client, GatewayIntentBits, Partials } = require('discord.js');
// const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
// const fs = require('fs');
// const FormData = require('form-data');
// const axios = require('axios');
// const prism = require('prism-media');
// const wav = require('wav');
// const ffmpeg = require('fluent-ffmpeg');
// const googleTTS = require('google-tts-api');
// const { google } = require('googleapis');
// const dotenv = require('dotenv');
// const archiver = require('archiver'); // ✅ เพิ่มที่ขาดหายไป
// dotenv.config();

// const client = new Client({
//     intents: [
//         GatewayIntentBits.Guilds,
//         GatewayIntentBits.GuildVoiceStates,
//         GatewayIntentBits.GuildMessages,
//         GatewayIntentBits.MessageContent
//     ],
//     partials: [Partials.Channel]
// });

// let activeStreams = new Map();
// const recordingsDir = './recordings';
// if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);

// client.once('ready', () => {
//     console.log('✅ Bot is ready!');
// });

// client.on('messageCreate', async (message) => {
//     const command = message.content.toLowerCase();

//     if (command === '!join') {
//         const channel = message.member.voice.channel;
//         if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');

//         const existingConnection = getVoiceConnection(channel.guild.id);
//         if (existingConnection) return message.reply('✅ บอทอยู่ในห้องแล้ว!');
        

//         const connection = joinVoiceChannel({
//             channelId: channel.id,
//             guildId: channel.guild.id,
//             adapterCreator: channel.guild.voiceAdapterCreator,
//             selfDeaf: false,
//         });

//         message.reply('✅ บอทเข้าห้องเสียงแล้ว! ใช้ `!record` เพื่อเริ่มบันทึกเสียง');
//         speak(connection, "บอทเข้าห้องแล้ว!");
//     }
//     if(command === '!guide'){
//         const channel = message.member.voice.channel;
//         if (!channel) return message.reply('นี้คือการอธิบายการใช้งาน!');
//         const connection = joinVoiceChannel({
//             channelId: channel.id,
//             guildId: channel.guild.id,
//             adapterCreator: channel.guild.voiceAdapterCreator,
//             selfDeaf: false,
//         });
//         speak(connection, "นี้คือการอธิบายการใช้งาน!");
//     }
//     if(command === '!joke'){
//         const channel = message.member.voice.channel;
//         if (!channel) return message.reply('อะไรเกิดก่อนไดโนเสาร์ นั้นคือ ไดโนศุกร์ไง!');
//         const connection = joinVoiceChannel({
//             channelId: channel.id,
//             guildId: channel.guild.id,
//             adapterCreator: channel.guild.voiceAdapterCreator,
//             selfDeaf: false,
//         });
//         speak(connection, "อะไรเกิดก่อนไดโนเสาร์ นั้นคือ ไดโนศุกร์ไง!");
//     }
//     if (command === '!record') {
//         const channel = message.member.voice.channel;
//         if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');

//         const connection = getVoiceConnection(channel.guild.id);
//         if (!connection) return message.reply('❌ บอทยังไม่ได้เข้าห้องเสียง! ใช้ `!join` ก่อน');

//         const receiver = connection.receiver;
//         receiver.speaking.setMaxListeners(0);
//         receiver.speaking.on('start', (userId) => {
//             if (activeStreams.has(userId)) return;
//             const user = message.guild.members.cache.get(userId);
//             if (!user) return;
//             const username = user.user.username
//             const userFile = `${recordingsDir}/${username}_${Date.now()}.wav`;
//             const fileStream = fs.createWriteStream(userFile);
//             const wavWriter = new wav.Writer({ sampleRate: 48000, channels: 2, bitDepth: 16 });
//             wavWriter.pipe(fileStream);

//             const audioStream = receiver.subscribe(userId, { end: { behavior: 'silence' } });
//             const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 1920 });
//             audioStream.pipe(decoder).pipe(wavWriter);

//             activeStreams.set(userId, { audioStream, fileStream, wavWriter, filePath: userFile });
//             audioStream.once('end', () => activeStreams.delete(userId));
//         });

//         message.reply(`🎙️ กำลังบันทึกเสียงรวมทุกคน! ใช้ \`!stop\` เพื่อหยุด`);
//         speak(connection, "เริ่มบันทึกเสียงแล้ว");
//     }

//     if (command === '!stop') {
//         if (activeStreams.size === 0) return message.reply('❌ ไม่มีการบันทึกเสียงอยู่!'); 
//         activeStreams.forEach(({ audioStream, fileStream, wavWriter }) => {
//             audioStream.destroy();
//             wavWriter.end();
//             fileStream.end();
//         });
//         activeStreams.clear();
//         const connection = getVoiceConnection(message.guild.id);
//                 if (connection) {
//                     const receiver = connection.receiver;
//                     if (receiver) {
//                         receiver.speaking.removeAllListeners('start');
//                     }
//                     connection.destroy();
//                 }
//         const zipFilePath = `./recordings_${Date.now()}.zip`;
//         try {
//             message.reply('📝 กำลังอัปโหลดและถอดเสียง กรุณารอสักครู่...');
//             await createZipFile(recordingsDir, zipFilePath);
//             const fileLink = await uploadToGoogleDrive(zipFilePath);
//             message.channel.send(`🔗 ดาวน์โหลดไฟล์เสียงจาก Google Drive: ${fileLink}`);

//             const transcriptions = await uploadZipToApi(zipFilePath);
//             message.channel.send(`📜 ถอดเสียงสำเร็จ:\n\`\`\`${transcriptions}\`\`\``);
//         } catch (error) {
//             console.error('❌ เกิดข้อผิดพลาดในการถอดเสียง:', error);
//             message.reply('❌ ไม่สามารถถอดเสียงได้');
//         }
//     }
// });

// async function createZipFile(sourceDir, outputFilePath) {
//     return new Promise((resolve, reject) => {
//         const output = fs.createWriteStream(outputFilePath);
//         const archive = archiver('zip', { zlib: { level: 9 } });

//         output.on('close', () => {
//             console.log(`✅ ZIP สร้างเสร็จ: ${outputFilePath}`);
            
//             // ลบไฟล์ทั้งหมดใน recordings หลังจาก ZIP เสร็จ
//             fs.readdir(sourceDir, (err, files) => {
//                 if (err) return console.error('❌ อ่านโฟลเดอร์ผิดพลาด:', err);
//                 files.forEach(file => {
//                     const filePath = `${sourceDir}/${file}`;
//                     fs.unlink(filePath, (err) => {
//                         if (err) console.error(`❌ ลบไฟล์ผิดพลาด: ${filePath}`, err);
//                         else console.log(`🗑️ ลบไฟล์: ${filePath}`);
//                     });
//                 });
//             });

//             resolve(outputFilePath);
//         });

//         archive.on('error', reject);
//         archive.pipe(output);
//         archive.directory(sourceDir, false);
//         archive.finalize();
//     });
// }


// async function uploadToGoogleDrive(filePath) {
//     try {
//         const auth = new google.auth.GoogleAuth({
//             keyFile: 'key.json',
//             scopes: ['https://www.googleapis.com/auth/drive.file'],
//         });

//         const drive = google.drive({ version: 'v3', auth });
//         const fileMetadata = { name: `record_${Date.now()}.zip`, mimeType: 'application/zip' };
//         const media = { mimeType: 'application/zip', body: fs.createReadStream(filePath) };

//         const response = await drive.files.create({ resource: fileMetadata, media: media, fields: 'id' });
//         if (!response.data.id) throw new Error('Google Drive upload failed');

//         const fileId = response.data.id;
//         await drive.permissions.create({ fileId: fileId, requestBody: { role: 'reader', type: 'anyone' } });

//         return `https://drive.google.com/file/d/${fileId}/view`;
//     } catch (error) {
//         console.error('❌ Google Drive upload error:', error);
//         throw new Error('❌ อัปโหลดไป Google Drive ล้มเหลว');
//     }
// }

// async function uploadZipToApi(zipFilePath) {
//     const fs = require('fs');
//     const axios = require('axios');
//     const FormData = require('form-data');

//     try {

//         const formData = new FormData();
//         formData.append('file', fs.createReadStream(zipFilePath));

//         const response = await axios.post('http://localhost:8000/transcribe/', formData, {
//             headers: {
//                 ...formData.getHeaders()
//             },
//             maxContentLength: Infinity,
//             maxBodyLength: Infinity,
//         });

//         console.log('✅ อัปโหลดเสร็จสิ้น');
//         console.log(response.data); // ตรวจสอบค่าที่ API ส่งกลับมา
//         return response.data; // ค่าที่ได้จะเป็นข้อความที่ API ส่งมา
//     } catch (error) {
//         console.error('❌ อัปโหลดล้มเหลว:', error.response?.data || error.message);
//         throw new Error('API upload failed');
//     }
// }


// async function speak(connection, text) {
//     try {
//         const url = googleTTS.getAudioUrl(text, {
//             lang: 'th',
//             slow: false,
//             host: 'https://translate.google.com',
//         });

//         const player = createAudioPlayer();
//         const resource = createAudioResource(url);

//         player.play(resource);
//         connection.subscribe(player);
//     } catch (error) {
//         console.error("❌ TTS error:", error);
//     }
// }

// client.login(process.env.TOKEN);
