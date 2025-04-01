import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { google } from 'googleapis';

export async function GenerateSummaryTextToPdf(text, guildid) {
    try {
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        const fontBytes = fs.readFileSync('./resource/THSarabunNew.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);

        const fontSize = 16;
        const margin = 50;
        const pageWidth = 595;
        const pageHeight = 842;
        const maxWidth = pageWidth - margin * 2;
        const lineHeight = fontSize * 1.5; // ปรับระยะห่างระหว่างบรรทัด

        let page = pdfDoc.addPage([pageWidth, pageHeight]); // หน้าแรก
        let y = pageHeight - margin;

        // ใช้ฟังก์ชัน wrapText ที่ปรับปรุงแล้ว
        const lines = wrapText(text, customFont, fontSize, maxWidth);

        for (const line of lines) {
            // หากพื้นที่เหลือไม่พอ ให้อ่านหน้าใหม่
            if (y - lineHeight < margin) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                y = pageHeight - margin;
            }

            page.drawText(line, {
                x: margin,
                y,
                font: customFont,
                size: fontSize,
                color: rgb(0, 0, 0),
            });
            y -= lineHeight;
        }

        const pdfBytes = await pdfDoc.save();
        const filePath = `./summary_${Date.now()}.pdf`;
        fs.writeFileSync(filePath, pdfBytes);

        const fileUrl = await uploadToGoogleDrive(filePath,guildid);
        fs.unlinkSync(filePath);
        return fileUrl;
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาด:', error);
    }
}

/**
 * ฟังก์ชันตัดข้อความให้อยู่ในขอบกระดาษ รองรับทั้งข้อความที่มีเว้นวรรคและข้อความภาษาไทยที่อาจไม่มีเว้นวรรค
 */
function wrapText(text, font, fontSize, maxWidth) {
    let lines = [];
    // แบ่งข้อความตามบรรทัดใหม่ (\n)
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        // ถ้าเป็นบรรทัดว่าง
        if (!paragraph.trim()) {
            lines.push('');
            continue;
        }
        
        // แบ่งคำในย่อหน้าตามช่องว่าง
        const words = paragraph.split(/\s+/);
        let currentLine = "";

        for (let word of words) {
            // ถ้าคำยาวเกิน maxWidth ให้แบ่งคำออกทีละตัวอักษร
            if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
                let parts = splitLongWord(word, font, fontSize, maxWidth);
                for (let part of parts) {
                    let testLine = currentLine ? currentLine + " " + part : part;
                    if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth) {
                        if (currentLine) {
                            lines.push(currentLine);
                        }
                        currentLine = part;
                    } else {
                        currentLine = testLine;
                    }
                }
            } else {
                let testLine = currentLine ? currentLine + " " + word : word;
                if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth) {
                    if (currentLine) {
                        lines.push(currentLine);
                    }
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
    }
    return lines;
}

/**
 * ฟังก์ชันแบ่งคำที่ยาวเกิน maxWidth ทีละตัวอักษร
 */
function splitLongWord(word, font, fontSize, maxWidth) {
    let parts = [];
    let currentPart = "";
    for (let char of Array.from(word)) {
        let testPart = currentPart + char;
        if (font.widthOfTextAtSize(testPart, fontSize) > maxWidth) {
            if (currentPart) {
                parts.push(currentPart);
                currentPart = char;
            } else {
                // กรณีที่ตัวอักษรเดียวเกิน maxWidth (หายาก)
                parts.push(char);
                currentPart = "";
            }
        } else {
            currentPart = testPart;
        }
    }
    if (currentPart) parts.push(currentPart);
    return parts;
}


/**
 * อัปโหลดไฟล์ PDF ไปยัง Google Drive
 */
async function uploadToGoogleDrive(filePath,guildid) {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'key.json',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const fileMetadata = {
        name: `summary_${guildid}_${Date.now()}.pdf`,
        mimeType: 'application/pdf'
    };
    const media = {
        mimeType: 'application/pdf',
        body: fs.createReadStream(filePath),
    };

    const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id',
    });

    const fileId = file.data.id;

    await drive.permissions.create({
        fileId: fileId,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    return `https://drive.google.com/file/d/${fileId}/view`;
}
