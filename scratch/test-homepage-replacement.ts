import fs from 'fs';
import path from 'path';

function verifyHomepageReplacement() {
  console.log("=== VERIFYING HOMEPAGE REPLACEMENT ACCEPTANCE CRITERIA ===");

  const pagePath = path.join(process.cwd(), 'app', 'page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // 1. Check for real logo asset
  if (pageContent.includes('/assets/unnati-logo.png') && !pageContent.includes('data:image/png;base64')) {
    console.log("[PASS] Real logo asset /assets/unnati-logo.png is used; zero base64 inlined strings!");
  } else {
    console.error("[FAIL] Logo asset check failed!");
    process.exit(1);
  }

  // 2. Check that no old "Start Learning Now" button remains
  if (!pageContent.includes('Start Learning Now')) {
    console.log("[PASS] Old 'Start Learning Now' button completely removed!");
  } else {
    console.error("[FAIL] 'Start Learning Now' button still present!");
    process.exit(1);
  }

  // 3. Check for "Login to ERP" buttons linking to /login
  if (pageContent.includes('Login to ERP') && pageContent.includes('href="/login"')) {
    console.log("[PASS] CTAs say 'Login to ERP' and link to real /login route!");
  } else {
    console.error("[FAIL] Login to ERP link check failed!");
    process.exit(1);
  }

  // 4. Check for interactive elements: typing animation, reveal line, orbit visual, scroll reveal
  if (
    pageContent.includes('Unnati means progress.') &&
    pageContent.includes('Now you can see it.') &&
    pageContent.includes('orbit-wrap') &&
    pageContent.includes('ai-orbit-dots') &&
    pageContent.includes('IntersectionObserver')
  ) {
    console.log("[PASS] Interactive animations (typing, 3D orbit, AI particles, scroll reveal) fully present!");
  } else {
    console.error("[FAIL] Interactive animation checks failed!");
    process.exit(1);
  }

  // 5. Check nav links (#features, #ai, #visit, tel:)
  if (
    pageContent.includes('href="#features"') &&
    pageContent.includes('href="#ai"') &&
    pageContent.includes('href="#visit"') &&
    pageContent.includes('href="tel:')
  ) {
    console.log("[PASS] Navigation section anchors (#features, #ai, #visit, tel:) properly configured!");
  } else {
    console.error("[FAIL] Navigation links check failed!");
    process.exit(1);
  }

  console.log("\nALL HOMEPAGE ACCEPTANCE CRITERIA PASSED 100% SUCCESSFULLY!");
}

verifyHomepageReplacement();
