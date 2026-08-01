import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function sendMessageWithRetry(chat: any, prompt: any, maxRetries = 3, initialDelay = 1000) {
    let delay = initialDelay;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await chat.sendMessage(prompt);
        } catch (err: any) {
            const errStr = String(err).toLowerCase();
            const isRateLimit = errStr.includes('429') || errStr.includes('quota') || errStr.includes('rate limit');
            const isUnavailable = errStr.includes('503') || errStr.includes('unavailable') || errStr.includes('overloaded') || errStr.includes('busy');
            
            if ((isRateLimit || isUnavailable) && attempt < maxRetries) {
                console.warn(`Gemini API busy/limit (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // exponential backoff
            } else {
                throw err;
            }
        }
    }
    throw new Error("Failed to get response after max retries");
}

export async function POST(req: Request) {
    try {
        console.log("Route hit");

        const body = await req.json();
        console.log("Body:", body);

        console.log("Key exists:", !!process.env.GEMINI_API_KEY);

        const { message, file, history } = body;

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            systemInstruction: "You are a helpful educational assistant for Unnati Powerprep. Help students with their exams, question papers, and concepts. Do NOT include raw markdown syntax like **, ##, ###, or --- in your text output. Present headings as clean section titles and lists as simple bullet points. For mathematical formulas, equations, or scientific expressions, ALWAYS format them using KaTeX LaTeX notation: use $...$ for inline math (e.g., $E = mc^2$) and $$...$$ for block equations (e.g., $$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$). You can see images and PDFs uploaded by students. Analyze them carefully to provide accurate solutions or explanations. Be encouraging, highly professional, clean, and clear.",
        });

        // Transform history for Gemini format
        const formattedHistory = (history || []).map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        // Start chat with history
        const chat = model.startChat({
            history: formattedHistory,
        });

        let prompt: any[] = [message || "Analyze this"];
        if (file && file.data && file.mimeType) {
            prompt = [
                {
                    inlineData: {
                        data: file.data,
                        mimeType: file.mimeType
                    }
                },
                message || "Analyze this"
            ];
        }

        const result = await sendMessageWithRetry(chat, prompt);
        const text = result.response.text();

        return Response.json({ reply: text });


    } catch (err) {
        console.error("CRASH:", err);
        return new Response(String(err), { status: 500 });
    }
}