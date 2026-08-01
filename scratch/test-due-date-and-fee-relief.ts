import { calculateStudentDueDate } from '../lib/fee-calculations';
import { formatDueDateFromEnrollment } from '../lib/fee-receipt-pdf';

async function testUserExactOrdinalDueDate() {
  console.log("=== TESTING USER EXACT ORDINAL DUE DATE ('20th of Every Month') ===");

  // 1. User Exact Example: Enrollment date "20/04/2026"
  console.log("\n1. Testing User Exact Example: Enrollment date '20/04/2026'...");
  const dueDate1 = formatDueDateFromEnrollment("20/04/2026");
  console.log(`Calculated Due Date: "${dueDate1}"`);

  if (dueDate1 === "20th of Every Month") {
    console.log("[PASS] Enrollment date '20/04/2026' correctly produces '20th of Every Month'!");
  } else {
    console.error(`[FAIL] Expected '20th of Every Month', got '${dueDate1}'`);
    process.exit(1);
  }

  // 2. ISO Format Example: Enrollment date "2026-04-20"
  console.log("\n2. Testing ISO Format: Enrollment date '2026-04-20'...");
  const dueDate2 = calculateStudentDueDate("2026-04-20");
  console.log(`Calculated Due Date: "${dueDate2}"`);

  if (dueDate2 === "20th of Every Month") {
    console.log("[PASS] Enrollment date '2026-04-20' correctly produces '20th of Every Month'!");
  } else {
    console.error(`[FAIL] Expected '20th of Every Month', got '${dueDate2}'`);
    process.exit(1);
  }

  // 3. Additional Ordinal Suffix Examples
  console.log("\n3. Testing Ordinal Suffixes (1st, 2nd, 3rd, 11th, 21st, 22nd, 23rd)...");
  const testCases = [
    { input: '01/05/2026', expected: '1st of Every Month' },
    { input: '02/05/2026', expected: '2nd of Every Month' },
    { input: '03/05/2026', expected: '3rd of Every Month' },
    { input: '11/05/2026', expected: '11th of Every Month' },
    { input: '21/05/2026', expected: '21st of Every Month' },
    { input: '22/05/2026', expected: '22nd of Every Month' },
    { input: '23/05/2026', expected: '23rd of Every Month' },
  ];

  for (const tc of testCases) {
    const res = formatDueDateFromEnrollment(tc.input);
    if (res === tc.expected) {
      console.log(`  [PASS] '${tc.input}' -> '${res}'`);
    } else {
      console.error(`  [FAIL] '${tc.input}' -> expected '${tc.expected}', got '${res}'`);
      process.exit(1);
    }
  }

  console.log("\nALL ORDINAL DUE DATE TESTS PASSED 100% SUCCESSFULLY!");
  process.exit(0);
}

testUserExactOrdinalDueDate().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
