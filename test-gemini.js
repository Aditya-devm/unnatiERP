const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function verifyModel() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Note: SDK automatically prefixes with models/ if not present, so "gemini-flash-latest" should work.
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        console.log("Attempting to generate short content with gemini-flash-latest...");
        const result = await model.generateContent("Hi");
        console.log("SUCCESS:", result.response.text());
    } catch (err) {
        console.error("DIAGNOSTIC FAILED:", err);
    }
}

verifyModel();
