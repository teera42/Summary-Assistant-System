import fs from 'fs';
import { google } from 'googleapis';
export async function uploadmp3ToGoogleDrive(filePath ,guildid) {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'key.json',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
        name: `record_${guildid}_${Date.now()}.mp3`,
        mimeType: 'audio/mpeg',
    };

    const media = {
        mimeType: 'audio/mpeg',
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