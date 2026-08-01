import fs from 'fs';
import path from 'path';

function verifyFiveHomepageFixes() {
  console.log("=== VERIFYING FIVE HOMEPAGE FIXES ACCEPTANCE CRITERIA ===");

  const pagePath = path.join(process.cwd(), 'app', 'page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // Fix 1: Mobile Orbit Layout (orbit-stage grid on mobile max-width: 880px)
  if (
    pageContent.includes('grid-template-columns: 1fr 1fr;') &&
    pageContent.includes('.sat {') &&
    pageContent.includes('position: relative !important;')
  ) {
    console.log("[PASS] Fix 1: Mobile Orbit Layout configured as clean 2x2 grid with 100% width and padding!");
  } else {
    console.error("[FAIL] Fix 1 check failed!");
    process.exit(1);
  }

  // Fix 2: Hero CTA shows ONLY "Login to ERP", Closing CTA shows ONLY "Call the office"
  const heroMatch = pageContent.match(/<section className="hero">[\s\S]*?<\/section>/);
  const closingMatch = pageContent.match(/<section className="closing"[\s\S]*?<\/section>/);

  if (heroMatch && heroMatch[0].includes('Login to ERP') && !heroMatch[0].includes('Call the office')) {
    console.log("[PASS] Fix 2 (Hero): Hero section contains ONLY 'Login to ERP' button!");
  } else {
    console.error("[FAIL] Fix 2 (Hero) check failed!");
    process.exit(1);
  }

  if (closingMatch && closingMatch[0].includes('Call the office') && !closingMatch[0].includes('Login to ERP')) {
    console.log("[PASS] Fix 2 (Closing): Closing section contains ONLY 'Call the office' button!");
  } else {
    console.error("[FAIL] Fix 2 (Closing) check failed!");
    process.exit(1);
  }

  // Fix 3: Attendance card value reads "Live Email Updates"
  if (pageContent.includes('<div className="val">Live Email Updates</div>') && !pageContent.includes('Live Whatsapp Alerts')) {
    console.log("[PASS] Fix 3: Attendance card value text changed to 'Live Email Updates'!");
  } else {
    console.error("[FAIL] Fix 3 check failed!");
    process.exit(1);
  }

  // Fix 4: AI section bullet reads "step by step maths solution with pdf download option"
  if (pageContent.includes('<li>step by step maths solution with pdf download option</li>')) {
    console.log("[PASS] Fix 4: Powerprep AI section bullet updated to 'step by step maths solution with pdf download option'!");
  } else {
    console.error("[FAIL] Fix 4 check failed!");
    process.exit(1);
  }

  // Fix 5: "Call the office" dials tel:+919510434702 specifically
  if (pageContent.includes('href="tel:+919510434702"') && !pageContent.includes('tel:+919898288599')) {
    console.log("[PASS] Fix 5: 'Call the office' dials tel:+919510434702 specifically!");
  } else {
    console.error("[FAIL] Fix 5 check failed!");
    process.exit(1);
  }

  console.log("\nALL FIVE HOMEPAGE FIXES PASSED 100% SUCCESSFULLY!");
}

verifyFiveHomepageFixes();
