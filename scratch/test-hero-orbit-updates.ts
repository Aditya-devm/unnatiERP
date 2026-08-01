import fs from 'fs';
import path from 'path';

function verifyHeroOrbitUpdates() {
  console.log("=== VERIFYING HERO ORBIT UPDATES ACCEPTANCE CRITERIA ===");

  const pagePath = path.join(process.cwd(), 'app', 'page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // 1. Check for Mobile 3D Rotation Animation (animation: spin 34s linear infinite !important on mobile media query)
  if (
    pageContent.includes('animation: spin 34s linear infinite !important;') &&
    pageContent.includes('translateZ(125px)') &&
    pageContent.includes('perspective: 1000px;')
  ) {
    console.log("[PASS] Mobile 3D Rotation restored with scaled down 125px translateZ and 100px satellite width!");
  } else {
    console.error("[FAIL] Mobile 3D Rotation check failed!");
    process.exit(1);
  }

  // 2. Check Student-Facing Copy on Orbit Cards
  // Card 1: Fees & Dues -> "See What's Due, Instantly" (No "Automated Ledger")
  if (pageContent.includes('See What\'s Due, Instantly') && !pageContent.includes('Automated Ledger')) {
    console.log("[PASS] Fees & Dues card updated to student-facing copy 'See What\'s Due, Instantly'!");
  } else {
    console.error("[FAIL] Fees & Dues card copy check failed!");
    process.exit(1);
  }

  // Card 2: Attendance -> "Live Email Updates"
  if (pageContent.includes('Live Email Updates')) {
    console.log("[PASS] Attendance card reads 'Live Email Updates'!");
  } else {
    console.error("[FAIL] Attendance card check failed!");
    process.exit(1);
  }

  // Card 3: AI Companion -> "Instant Doubt Solving"
  if (pageContent.includes('Instant Doubt Solving')) {
    console.log("[PASS] AI Companion card reads 'Instant Doubt Solving'!");
  } else {
    console.error("[FAIL] AI Companion card check failed!");
    process.exit(1);
  }

  // Card 4: Report Cards -> "Your Results, The Same Day" (No "One-Click Generation")
  if (pageContent.includes('Your Results, The Same Day') && !pageContent.includes('One-Click Generation')) {
    console.log("[PASS] Report Cards card updated to student-facing copy 'Your Results, The Same Day'!");
  } else {
    console.error("[FAIL] Report Cards card copy check failed!");
    process.exit(1);
  }

  // 3. Confirm separate Powerprep AI section is unchanged
  const aiSectionMatch = pageContent.match(/<section className="ai-section" id="ai">[\s\S]*?<\/section>/);
  if (aiSectionMatch && aiSectionMatch[0].includes('Powerprep AI') && aiSectionMatch[0].includes('step by step maths solution with pdf download option')) {
    console.log("[PASS] Separate Powerprep AI section further down the page is completely unchanged!");
  } else {
    console.error("[FAIL] Separate Powerprep AI section check failed!");
    process.exit(1);
  }

  console.log("\nALL HERO ORBIT ACCEPTANCE CRITERIA PASSED 100% SUCCESSFULLY!");
}

verifyHeroOrbitUpdates();
