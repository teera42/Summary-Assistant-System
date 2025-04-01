import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection} from '@discordjs/voice';
import  fs from 'fs'
import prism  from 'prism-media'
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { summarizeText } from './summarizefunc.js';
import { speak } from './speakfunc.js';
import { uploadmp3ToGoogleDrive } from './uploadmp3gdfunc.js';
import { transcribeAudio } from './transcribeaudiofunc.js';
import { GenerateSummaryTextToPdf } from './genpdffunc.js';
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
const activeVoiceConnections = new Map();
const cooldowns = new Map();
let userOutputFile = null;
const recordingServers = new Map(); 
const recordedMembers = new Set();

client.once('ready', () => {
    console.log('✅ Bot is ready!');
});

client.on('messageCreate', async (message) => {
    const command = message.content.toLowerCase();
   
    if (command === '!join') {
        const channel = message.member.voice.channel;
        if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');
        let connection = getVoiceConnection(message.guild.id);
        const now = Date.now();
        const cooldownAmount = 5000; 
        if (cooldowns.has(message.author.id)) {
            const expirationTime = cooldowns.get(message.author.id) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return message.reply(`❌ คุณต้องรออีก ${timeLeft.toFixed(0)} วินาที ก่อนใช้คำสั่งนี้อีกครั้ง`);
            }
        }  
         cooldowns.set(message.author.id, now);
         if (connection) {
            // ตรวจสอบสถานะของการเชื่อมต่อ
            if (connection.state.status === 'ready' && connection.joinConfig.channelId === channel.id) {
                return message.reply('⚠️ บอทอยู่ในห้องเสียงนี้แล้ว!');
            } else {
                // ถ้าบอทไม่ได้อยู่ในห้องที่ผู้ใช้ต้องการ
                connection.disconnect(); // Disconnect
            }
        }
    
        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: message.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        
     
        message.reply(`บอทเข้าห้องเสียงเรียบร้อยแล้ว! 🎤
-หากต้องการดูวิธีการใช้งาน กรุณาใช้คำสั่ง !guide
-หากต้องการบันทึกเสียง ให้ใช้คำสั่ง !record เพื่อเริ่มบันทึกเสียง 🎶`);
        speak(connection, "บอทเข้าห้องแล้ว!");
    }
    else if(command === '!randomfood'){
        const channel = message.member.voice.channel;
        const random_food_res = random_food(); 
        const textResponse = `อาหารที่สุ่มได้ คือ... 🎺 ${random_food_res} นั่นเอง!`;
       if (!channel) return message.reply( textResponse);
       let connection = getVoiceConnection( message.guild.id);
       if (!connection) {
        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
    }
        speak(connection, textResponse);
        message.reply(textResponse); 
        }
       else if (command === '!guide') {
            const channel = message.member.voice.channel;
            const textResponse = "📝 นี้คือการอธิบายการใช้งาน!";
        
            if (!channel) {
                return message.reply(`🔗 อ่านวิธีใช้งานจาก Google Drive: https://drive.google.com/file/d/1R9zqFf8wa-_1JIg6L8lvDQMU21KSOT1r/view?usp=sharing`);
            }
            let connection = getVoiceConnection( message.guild.id);
            
            if (!connection) {
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: false,
            });
        }
            const now = Date.now();
        const cooldownAmount = 5000; 
        if (cooldowns.has(message.author.id)) {
            const expirationTime = cooldowns.get(message.author.id) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return message.reply(`❌ คุณต้องรออีก ${timeLeft.toFixed(0)} วินาที ก่อนใช้คำสั่งนี้อีกครั้ง`);
            }
        }
        cooldowns.set(message.author.id, now);       
            speak(connection, textResponse); 
            message.channel.send(`🔗 อ่านวิธีใช้งานจาก Google Drive: https://drive.google.com/file/d/1R9zqFf8wa-_1JIg6L8lvDQMU21KSOT1r/view?usp=sharing`);
        }
        
        else if(command === '!joke'){
        const channel = message.member.voice.channel;
        const randomjoke = random_joke();
        const textResponse = `ฉันแนะนำมุกตลกนี้ ${randomjoke} ฮาไหม?`
        if (!channel) return message.reply(textResponse);
        let connection = getVoiceConnection( message.guild.id);
        
        if (!connection) {
        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
    }
        message.reply(textResponse); 
        speak(connection, textResponse);
    }
    else if (command === '!participants') {
        const channel = message.member.voice.channel;
        if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');
        let connection = getVoiceConnection( message.guild.id);
        if (!connection) {
            message.reply('❌ บอทยังไม่ได้เข้าห้องเสียง! ใช้ `!join` ก่อน');
            return;
        }
        if (channel.id !== connection.joinConfig.channelId) {
            return message.reply('❌ กรุณาใช้ `!join` ใหม่ เพื่อย้ายมาห้องนี้!');
        }
        const now = Date.now();
        const cooldownAmount = 5000; 
        if (cooldowns.has(message.author.id)) {
            const expirationTime = cooldowns.get(message.author.id) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return message.reply(`❌ คุณต้องรออีก ${timeLeft.toFixed(0)} วินาที ก่อนใช้คำสั่งนี้อีกครั้ง`);
            }
        }
        cooldowns.set(message.author.id, now);
    
        const members = channel.members
            .filter(member => !member.user.bot) 
            .map(member => member.displayName)
            .join(', ');
    
        if (!members) return message.reply('❌ ไม่มีสมาชิกอยู่ในห้องเสียง');
    
        message.reply(`👥 ผู้เข้าร่วมประชุม: ${members}`);
        speak(connection, `👥 ผู้เข้าร่วมประชุม: ${members}`);
    }    
    else if (command === '!record') {
        const channel = message.member.voice.channel;
        if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');
    
        let connection = getVoiceConnection(message.guild.id);
        
        if (!connection) {
            message.reply('❌ บอทยังไม่ได้เข้าห้องเสียงนี้! ใช้ `!join` ก่อน');
            return;
        }
        if (channel.id !== connection.joinConfig.channelId) {
            return message.reply('❌ กรุณาใช้ `!join` ใหม่ เพื่อย้ายมาห้องนี้!');
        }
    
        const now = Date.now();
        const cooldownAmount = 5000;
        if (cooldowns.has(message.author.id)) {
            const expirationTime = cooldowns.get(message.author.id) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return message.reply(`❌ คุณต้องรออีก ${timeLeft.toFixed(0)} วินาที ก่อนใช้คำสั่งนี้อีกครั้ง`);
            }
        }
        cooldowns.set(message.author.id, now);
    
        if (recordingServers.has(message.guild.id)) {
            return message.reply('⚠️ มีการใช้งานบันทึกเสียงอยู่แล้ว และไม่เริ่มการบันทึกใหม่');
        }
    
        const receiver = connection.receiver;
        recordedMembers.clear();
        receiver.speaking.setMaxListeners(0);
        
        // เก็บชื่อสมาชิกในห้องเสียง
        channel.members.forEach(member => {
            recordedMembers.add(member.displayName);
        });
    
        // ตรวจสอบว่ามีคนในห้องเสียงหรือไม่
        if (recordedMembers.size === 0) {
            message.reply('❌ ไม่มีใครในห้องเสียง กำลังยกเลิกการบันทึก');
            connection.disconnect();
            return;
        }
    
        outputPath = `./recordings/recording_${message.guild.id}_${Date.now()}.mp3`;
        const audioStream = fs.createWriteStream(outputPath); // สร้าง stream สำหรับ MP3
        const ffmpegProcess = spawn('ffmpeg', [
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            '-i', 'pipe:0',
            '-b:a', '256k',
            '-f', 'mp3',
            'pipe:1'
        ]);
    
        ffmpegProcess.stdout.pipe(audioStream);
        recordingServers.set(message.guild.id, { connection, outputPath });
    
        // ตั้งค่าตัวแปร activeStreams ให้เริ่มบันทึกเสียง
        activeStreams.clear();
    
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
    
            audioReceiver.pipe(decoder).pipe(ffmpegProcess.stdin, { end: false });
    
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
    
        // เช็คว่าบอทถูกตัดการเชื่อมต่อหรือไม่
        connection.on('disconnect', () => {
            message.reply('❌ บอทถูกตัดการเชื่อมต่อ! การบันทึกถูกยกเลิก');
            if (recordingServers.has(message.guild.id)) {
                const { outputPath } = recordingServers.get(message.guild.id);
                fs.unlinkSync(outputPath); // ลบไฟล์ที่บันทึก
                recordingServers.delete(message.guild.id); // ลบข้อมูลการบันทึก
            }
        });
    
        message.reply('🎙️ กำลังบันทึกเสียง! ใช้ `!stop` เพื่อหยุด');
    
        speak(connection, "เริ่มบันทึกเสียงแล้ว");
    
    }
    
    

    else if (command === '!stop') {
        if (recordingServers.size === 0) {
            return message.reply('❌ บอทยังไม่ได้เริ่มบันทึกเสียง! ใช้ `!record` ก่อน');
        }
        
        if (!recordingServers.has( message.guild.id)) {
            return message.reply('❌ บอทยังไม่ได้เริ่มบันทึกเสียงในเซิร์ฟเวอร์นี้!');
        }
        
        const { connection, outputPath, userOutputFile } = recordingServers.get( message.guild.id);
        
        if (connection) {
            const channel = message.member.voice.channel;
        // เช็คว่า user อยู่ในห้องเดียวกับบอทหรือไม่
        if (!channel) {
            return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');
        }

        // ตรวจสอบว่า connection มีการเชื่อมต่ออยู่ในห้องนี้หรือไม่
        if (connection.joinConfig.channelId !== channel.id) {
            return message.reply('❌ บอทไม่อยู่ในห้องเสียงนี้!');
        }

            const receiver = connection.receiver;
            if (receiver) {
                receiver.speaking.removeAllListeners('start'); // ลบ event listener ของ speaking
            }
            connection.destroy(); // ออกจากห้องเสียง
        }
    
        if (userOutputFile) {
            userOutputFile.end();
        }
        
        recordingServers.delete( message.guild.id);
        activeStreams.clear();
    
        if (outputPath) {
            try {
                const fileStats = fs.statSync(outputPath);
        
                // ตรวจสอบว่าไฟล์มีขนาดมากกว่า 0 หรือไม่
                if (fileStats.size === 0) {
                    return message.reply('❌ ไฟล์ที่บันทึกมีขนาดเป็นศูนย์ ไม่สามารถอัปโหลดได้');
                }
                message.reply('📝 กำลังอัปโหลดและถอดเสียง กรุณารอสักครู่...');
                const fileLink = await uploadmp3ToGoogleDrive(outputPath,`${message.guild.id}`);
                message.channel.send(`🔗 ดาวน์โหลดไฟล์เสียงจาก Google Drive: ${fileLink}`);
                const transcription = await transcribeAudio(outputPath);
                // message.channel.send(`📜 ถอดเสียง:\n\`\`\`${transcription}\`\`\``);
               const summary = await summarizeText(transcription,recordedMembers);
                // message.channel.send(`📑 สรุปเนื้อหาการประชุม:\n\`\`\`${summary}\`\`\``);
                const filepdfLink = await GenerateSummaryTextToPdf(summary,`${message.guild.id}`);
                message.channel.send(`🔗 ดาวน์โหลดไฟล์pdfสรุปการประชุมได้จาก Google Drive: ${filepdfLink}`);
                 recordedMembers.clear
            } catch (error) {
                console.error('❌ เกิดข้อผิดพลาดในการถอดเสียง:', error);
                message.reply('❌ ไม่สามารถถอดเสียงได้');
            }
        } else {
            message.reply('❌ ไม่พบไฟล์ที่บันทึก!');
        }
    }
    else if (command === '!leave') {
        const channel = message.member.voice.channel;
        
        // ตรวจสอบว่า user อยู่ในห้องเสียงหรือไม่
        if (!channel) return message.reply('❌ คุณต้องอยู่ในห้องเสียงก่อน!');
    
        let connection = getVoiceConnection(message.guild.id);
    
        if (!connection) {
            return message.reply('❌ บอทยังไม่ได้เข้าห้องเสียงนี้!');
        }
    
        // ตรวจสอบว่าบอทอยู่ในห้องเดียวกับผู้ใช้หรือไม่
        if (connection.joinConfig.channelId !== channel.id) {
            return message.reply('❌ บอทไม่อยู่ในห้องเสียงนี้!');
        }
    
        // ตัดการเชื่อมต่อ
        connection.disconnect();
    
        // แจ้งเตือน
        message.reply('👋 บอทออกจากห้องเสียงแล้ว!');
    }
     
});



function random_food() {
    const food = [
        'ผัดกะเพรา', 'ข้าวผัด', 'ต้มยำกุ้ง', 'แกงเขียวหวาน', 'ก๋วยเตี๋ยว',
        'ส้มตำ', 'หมูกระทะ', 'ข้าวมันไก่', 'ปูผัดผงกะหรี่', 'ไก่ทอด',
        'ข้าวขาหมู', 'ยำวุ้นเส้น', 'แกงส้ม', 'หมูทอดกระเทียม', 'ไข่เจียวหมูสับ',
        'ข้าวคลุกกะปิ', 'ข้าวหน้าเป็ด', 'ปลาทอดน้ำปลา', 'ปลากะพงนึ่งมะนาว', 'ลาบหมู',
        'น้ำตกหมู', 'กุ้งเผา', 'ปลาหมึกย่าง', 'หมูสะเต๊ะ', 'หอยทอด',
        'ผัดไทย', 'ข้าวหมูแดง', 'ข้าวหมูกรอบ', 'ข้าวหน้าไก่', 'โจ๊กหมู',
        'ขนมจีนแกงไก่', 'ขนมจีนแกงเขียวหวาน', 'แกงป่า', 'แกงไตปลา', 'คั่วกลิ้งหมู',
        'ไส้อั่ว', 'ข้าวซอยไก่', 'ไก่ย่าง', 'แกงจืดเต้าหู้หมูสับ', 'กะเพราหมูกรอบ'
    ];
    return food[Math.floor(Math.random() * food.length)];
}
 function random_joke(){
    const joke = [
        "แฟนบอกให้ลดน้ำหนัก… เลยลดความสัมพันธ์แทน 😜",
        "เพื่อน: นี่แหละชีวิต… เรา: แล้วเมื่อไหร่จะได้ใช้ชีวิตดีๆ ซักที! 😂",
        "ขับรถผ่านโรงพยาบาล หันไปบอกแฟนว่า ‘ที่รัก… ฉันเข้าเธอแล้วนะ’ 🤣",
        "เป็นคนอบอุ่น… อุ่นจนเป็นหมูแดดเดียว ☀️🐷",
        "เงินเดือนไม่ใช่แม่น้ำ แต่ทำไมหายไปเร็วขนาดนี้? 💸",
        "อกหักเป็นเรื่องปกติ แต่ไม่มีตังค์นี่สิ ปัญหาใหญ่!! 😭",
        "สั่งอาหารมากินเองยังผิดหวัง แล้วจะหวังอะไรกับความรัก 😆",
        "จะลดน้ำหนักตั้งแต่ปีที่แล้ว แต่น้ำหนักดันลดเราแทน 😂",
        "ขับรถชนหมา เจ้าของด่า 'หมาฉันมีค่ามาก' เราตอบไป 'หนี้ฉันก็มีค่าเหมือนกัน' 😅",
        "นัดเจอเพื่อนบอกจะถึงแล้ว… ที่จริงยังอยู่บ้าน 🤣",
        "หมอบอกให้พักผ่อนเยอะๆ แต่ลืมบอกว่าต้องพักเงินด้วย 😅",
        "งานคือเงิน เงินคืองาน แล้วทำไมฉันมีแต่งาน ไม่มีเงิน! 😭",
        "ที่บ้านเรียกขุนแผน แต่ที่แฟนเรียก ‘ไอ้คนไม่มีตังค์’ 😆",
        "รักแท้ดูแลให้ไม่ได้ แต่รักแท้โอนให้ได้นะ 💳💸",
        "เครียดเรื่องเงินจนไปหาหมอ หมอบอกให้พัก… พักหนี้ก่อนดีไหม? 😵",
        "ไปหาหมอ หมอบอกให้ดื่มน้ำเยอะๆ เลยดื่มชาไข่มุกแทน 🧋🤣",
        "อยากเป็นเศรษฐี…แต่เป็นหนี้แทนเฉยเลย 😅",
        "แฟนถาม ‘เธอจะรักฉันตลอดไปมั้ย?’ เราตอบ ‘ถ้าตลอดไปหมายถึงสิ้นเดือน ก็ได้อยู่’ 😂",
        "ไปกินหมูกระทะ แฟนถามรักมากแค่ไหน ตอบไปว่า ‘มากเท่าไขมันในตัว’ 🤣",
        "อยู่คนเดียวไม่เหงา…แต่ถ้ามีตังค์อยู่คนเดียวจะดีกว่า 😂",
        "อะไรเกิดก่อนไดโนเสาร์ คำตอบ ไดโนศุกร์ไง 😂",
      ];
      
    return joke[Math.floor(Math.random()*joke.length)];
 }


client.on('voiceStateUpdate', (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member) return;

    const displayName = member.displayName;
    const newChannel = newState.channel;
    const oldChannel = oldState.channel;
    const guildId = newState.guild.id;
    const connection = getVoiceConnection(guildId);

    if (newChannel) {
        // ตรวจสอบว่าบอทมีข้อมูลใน guild.me หรือไม่
        const botPermissions = newChannel.guild.me ? newChannel.guild.me.permissionsIn(newChannel) : null;
        if (botPermissions && !botPermissions.has("CONNECT")) {
            return newState.guild.channels.cache.get(newChannel.id).send('❌ บอทไม่มีสิทธิ์เข้าห้องเสียง กรุณาให้สิทธิ์ก่อน');
        }
    }
    // บันทึกชื่อผู้ใช้เมื่อเข้าห้องเสียง
    if (newChannel && !recordedMembers.has(displayName)) {
        recordedMembers.add(displayName);
    }
    // ตรวจสอบการออกจากห้องเสียงของบอท
    if (newState.member.id === client.user.id && oldState.channel && !newState.channel) {
        // ถ้าบอทถูก disconnect ออกจากห้องเสียง
        oldState.guild.channels.cache.get(oldState.channel.id)
            .send('❌ บอทถูก disconnect จากห้องเสียง!');  // ส่งข้อความแจ้งเตือน
    }
    // ตรวจสอบว่าบอทอยู่ในห้องเสียงหรือไม่
    if (!connection) return;

    const channel = connection.joinConfig.channelId 
        ? newState.guild.channels.cache.get(connection.joinConfig.channelId) 
        : null;

    if (!channel) return;

    // เช็คจำนวนผู้ใช้ที่ไม่ใช่บอทในห้องเสียง
    const membersInChannel = channel.members.filter(member => !member.user.bot).size;

    if (membersInChannel === 0) {
        // ถ้าไม่มีสมาชิกในห้องเสียง บอทจะออกหลัง 60 วินาที
        if (!activeVoiceConnections.has(guildId)) {
            activeVoiceConnections.set(guildId, setTimeout(() => {
                const conn = getVoiceConnection(guildId);
                if (conn) {
                    conn.destroy();
                }
                activeVoiceConnections.delete(guildId);
            }, 60000)); // ตั้งเวลา 60 วินาที
        }
    } else {
        // ถ้ามีสมาชิกกลับเข้ามา ให้ยกเลิกการออก
        if (activeVoiceConnections.has(guildId)) {
            clearTimeout(activeVoiceConnections.get(guildId));
            activeVoiceConnections.delete(guildId);
        }
    }
    if (newState.member.id === client.user.id && oldState.channel && !newState.channel) {
        // ถ้าบอทถูกย้ายออกจากห้องเสียงและมีการบันทึกเสียง
        if (recordingServers.has(guildId)) {
            // ยกเลิกการบันทึกเสียง
            const { outputPath } = recordingServers.get(guildId);
            fs.unlinkSync(outputPath); // ลบไฟล์ที่บันทึก
            recordingServers.delete(guildId); // ลบข้อมูลการบันทึก

            newState.guild.channels.cache
                .get(oldState.channel.id)
                .send('❌ บอทถูกย้ายออกจากห้องเสียง! การบันทึกถูกยกเลิก');
        }
    }
});

client.login(process.env.TOKEN);