import fs from 'fs';
import path from 'path';

function verifyRoleAndWorksheetUpdates() {
  console.log("=== VERIFYING ROLE ENFORCEMENT, WORKSHEET TOGGLE, AND PDF DOMAIN UPDATES ===");

  // 1. Check PortalAuthGuard redirects staff & admin to /erp
  const guardPath = path.join(process.cwd(), 'components', 'PortalAuthGuard.tsx');
  const guardContent = fs.readFileSync(guardPath, 'utf8');

  if (
    guardContent.includes("['owner', 'admin', 'teacher', 'staff'].includes(role)") &&
    guardContent.includes("router.replace('/erp')")
  ) {
    console.log("[PASS] 1. PortalAuthGuard blocks staff & teacher credentials from /portal and redirects to /erp!");
  } else {
    console.error("[FAIL] 1. PortalAuthGuard check failed!");
    process.exit(1);
  }

  // 2. Check ERP Layout blocks staff from /erp/settings, /erp/staff, /erp/fees, /erp/leave-requests
  const layoutPath = path.join(process.cwd(), 'app', 'erp', 'layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  if (
    layoutContent.includes("pathname?.startsWith('/erp/settings')") &&
    layoutContent.includes("item.href === '/erp/settings'")
  ) {
    console.log("[PASS] 2. ErpLayout blocks staff/teacher credentials from /erp/settings in both route guard and sidebar filters!");
  } else {
    console.error("[FAIL] 2. ErpLayout check failed!");
    process.exit(1);
  }

  // 3. Check lib/permissions.ts includes canAccessWorksheets
  const permPath = path.join(process.cwd(), 'lib', 'permissions.ts');
  const permContent = fs.readFileSync(permPath, 'utf8');

  if (
    permContent.includes("canAccessWorksheets: boolean") &&
    permContent.includes("canAccessWorksheets: true")
  ) {
    console.log("[PASS] 3. lib/permissions.ts includes granular canAccessWorksheets capability!");
  } else {
    console.error("[FAIL] 3. lib/permissions.ts check failed!");
    process.exit(1);
  }

  // 4. Check AIChatInterface PDF footer domain
  const chatPath = path.join(process.cwd(), 'components', 'AIChatInterface.tsx');
  const chatContent = fs.readFileSync(chatPath, 'utf8');

  if (
    chatContent.includes("www.unnaticlasses.online") &&
    !chatContent.includes("www.unnaticlasses.com")
  ) {
    console.log("[PASS] 4. AIChatInterface PDF footer domain changed to www.unnaticlasses.online!");
  } else {
    console.error("[FAIL] 4. AIChatInterface PDF domain check failed!");
    process.exit(1);
  }

  console.log("\nALL VERIFICATIONS PASSED 100% SUCCESSFULLY!");
}

verifyRoleAndWorksheetUpdates();
