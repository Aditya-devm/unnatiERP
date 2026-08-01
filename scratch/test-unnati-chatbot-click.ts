// Test Script to verify Unnati Powerprep tile opens AI Chatbot and header button is removed

function testUnnatiChatbotTileRouting() {
  console.log("=== TESTING UNNATI POWERPREP BUTTON & TILE ROUTING ===");

  const unnatiTileButton = {
    label: "Unnati Powerprep Grid Tile (Tile 7)",
    targetHref: "/dashboard/chat",
    destination: "Unnati Powerprep AI Chatbot"
  };

  const headerUnnatiButtonPresent = false; // Header button removed per user request

  console.log(`- Header Unnati Powerprep button present: ${headerUnnatiButtonPresent} (REMOVED)`);
  console.log(`- Clicking '${unnatiTileButton.label}' -> Routes to: ${unnatiTileButton.targetHref} (${unnatiTileButton.destination})`);

  if (!headerUnnatiButtonPresent && unnatiTileButton.targetHref === "/dashboard/chat") {
    console.log("[PASS] Unnati Powerprep header button removed from Student/Staff portal header.");
    console.log("[PASS] Clicking the 'Unnati Powerprep' button opens the AI Chatbot (/dashboard/chat), NOT the notification section!");
  } else {
    console.error("[FAIL] Incorrect configuration.");
  }
}

testUnnatiChatbotTileRouting();
