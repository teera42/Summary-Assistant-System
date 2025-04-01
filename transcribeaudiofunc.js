import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
export async function transcribeAudio(filePath) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("❌ ไม่พบ API Key ของ OpenAI");
        }
        const formData = new FormData();
        formData.append("file", fs.createReadStream(filePath));
        formData.append("model", "whisper-1");
        formData.append("language", "th"); 
        formData.append("temperature", "0.2"); 

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

