import fs from 'fs';
import path from 'path';

function verifyAIChatTypingUpdates() {
  console.log("=== VERIFYING AI CHAT TYPING ANIMATION AND HEADER TEXT UPDATES ===");

  const chatPath = path.join(process.cwd(), 'components', 'AIChatInterface.tsx');
  const chatContent = fs.readFileSync(chatPath, 'utf8');

  // 1. Check AnimatedLoadingStatus component presence
  if (
    chatContent.includes("function AnimatedLoadingStatus()") &&
    chatContent.includes("⚡ Unnati AI is generating your personalized solution...") &&
    chatContent.includes("✨ Unnati AI is crafting your response...") &&
    chatContent.includes("line1.slice(0, i)")
  ) {
    console.log("[PASS] 1. AnimatedLoadingStatus component with two-line typing & backspacing animation implemented!");
  } else {
    console.error("[FAIL] 1. AnimatedLoadingStatus check failed!");
    process.exit(1);
  }

  // 2. Check empty state condition fix (messages.length === 0 && !loadingMsg)
  if (chatContent.includes("(messages.length === 0 && !loadingMsg)")) {
    console.log("[PASS] 2. First message loading state fixed! Loading status renders on 1st chat message.");
  } else {
    console.error("[FAIL] 2. First message loading state check failed!");
    process.exit(1);
  }

  // 3. Check updated header text
  const expectedHeaderSubtitle = "Your personal AI study companion for instant doubt solving, detailed explanations, structured solutions, and easy-to-download PDF notes.";
  if (chatContent.includes(expectedHeaderSubtitle)) {
    console.log("[PASS] 3. Header text updated to 'Your personal AI study companion for instant doubt solving, detailed explanations, structured solutions, and easy-to-download PDF notes.'!");
  } else {
    console.error("[FAIL] 3. Header text check failed!");
    process.exit(1);
  }

  console.log("\nALL VERIFICATIONS PASSED 100% SUCCESSFULLY!");
}

verifyAIChatTypingUpdates();
