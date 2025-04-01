import axios from 'axios';

export async function summarizeText(text, recordedMembers) {
    console.log(recordedMembers);
    const membersList = Array.from(recordedMembers).join(', ');
    const currentDate = new Date(Date.now());
    const day = currentDate.getDate().toString().padStart(2, '0');  // วัน
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');  // เดือน (เดือนเริ่มต้นที่ 0)
    const year = currentDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("❌ ไม่พบ API Key ของ OpenAI");
        }

        recordedMembers = recordedMembers || "ไม่ระบุ";

        const prompt = `
  รายงานการประชุม

วันที่ประชุม: [ระบุวันที่จากเนื้อหา หรือ "ไม่ระบุ"]
หัวข้อการประชุม: [สรุปหัวข้อการประชุม]
ผู้เข้าร่วมประชุม: [สมาชิกการประชุม]

   1. สาระสำคัญของการประชุม  
ประเด็นหลักที่หารือ:  
[สรุปประเด็นสำคัญ]

   2. ความคืบหน้าของงาน  
งานที่ดำเนินการเสร็จสิ้น:  
[รายการงานที่สำเร็จ]

   3. ปัญหาและอุปสรรค  
ปัญหาที่พบ:  
[สรุปปัญหาและอุปสรรค]

   4. แนวทางแก้ไขและแผนดำเนินงานต่อไป  
ข้อเสนอแนะแนวทางแก้ไข:  
[แนวทางแก้ปัญหาหรือข้อเสนอแนะ]

กำหนดการประชุมครั้งถัดไป:  
[ระบุวัน หรือ "ยังไม่กำหนด"]

มติที่ประชุม:  
[ข้อสรุปหรือการตัดสินใจสำคัญ]

   5. หมายเหตุเพิ่มเติม  
ข้อมูลเพิ่มเติม:  
[ข้อสังเกตอื่น ๆ]
`;

        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4o-mini",
                messages: [
                    { "role": "system", "content": `ช่วยสรุปการประชุมในรูปแบบนี้: ${prompt}` },
                    { "role": "user", "content": `เนื้อหา :${text} รายชื่อคนเข้าประชุม : ${membersList} วันที่ประชุม:${formattedDate}` }
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
