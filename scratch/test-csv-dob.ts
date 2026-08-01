import { normalizeDateToYYYYMMDD, formatDDMMYYYY, parseAndValidateStudentCSV } from '../lib/csv-helpers';

async function testCSVDODates() {
  console.log("=== TESTING CSV STUDENT IMPORT DATE OF BIRTH (DD/MM/YYYY) ===");

  // 1. Test Date Normalization (DD/MM/YYYY -> YYYY-MM-DD)
  console.log("\n1. Testing Date Normalization Helper...");
  const n1 = normalizeDateToYYYYMMDD('14/05/2008');
  const n2 = normalizeDateToYYYYMMDD('20/11/2009');
  const n3 = normalizeDateToYYYYMMDD('01/01/2010');
  const n4 = normalizeDateToYYYYMMDD('2008-05-14');

  console.log(`14/05/2008 -> ${n1}`);
  console.log(`20/11/2009 -> ${n2}`);
  console.log(`01/01/2010 -> ${n3}`);
  console.log(`2008-05-14 -> ${n4}`);

  if (n1 === '2008-05-14' && n2 === '2009-11-20' && n3 === '2010-01-01' && n4 === '2008-05-14') {
    console.log("[PASS] Date normalization to YYYY-MM-DD working perfectly!");
  } else {
    console.error("[FAIL] Date normalization failed!");
    process.exit(1);
  }

  // 2. Test Format Helper (YYYY-MM-DD -> DD/MM/YYYY)
  console.log("\n2. Testing Date Formatting Helper...");
  const f1 = formatDDMMYYYY('2008-05-14');
  const f2 = formatDDMMYYYY('2009-11-20');
  console.log(`2008-05-14 -> ${f1}`);
  console.log(`2009-11-20 -> ${f2}`);

  if (f1 === '14/05/2008' && f2 === '20/11/2009') {
    console.log("[PASS] Date formatting to DD/MM/YYYY working perfectly!");
  } else {
    console.error("[FAIL] Date formatting failed!");
    process.exit(1);
  }

  // 3. Test Full CSV Content Parsing with DD/MM/YYYY DOB & Portal Password
  console.log("\n3. Testing CSV Parsing with DD/MM/YYYY DOB & Portal Password...");
  const testCSVContent = `Roll Number,Full Name*,Father Name*,Mother Name*,Aadhar Number,Date of Birth (DD/MM/YYYY)*,Gender*,Student Phone*,WhatsApp Number*,Email*,Portal Password,Parent Name,Parent Phone,Address*,Enrollment Date (DD/MM/YYYY),Monthly Fee*,Status
UP-101,"Aarav Sharma","Rajesh Sharma","Sunita Sharma","123456789012","14/05/2008","male","+91 9876543210","+91 9876543210","aarav.sharma@example.com","Aarav@2026","Rajesh Sharma","+91 9876543210","Sector 22, Kalol, Gujarat","01/07/2026","2500","active"
UP-102,"Ananya Patel","Vikram Patel","Meena Patel","987654321098","20/11/2009","female","+91 9876543211","+91 9876543211","ananya.patel@example.com","Ananya@2026","Vikram Patel","+91 9876543211","Station Road, Kalol, Gujarat","01/07/2026","2000","active"`;

  const parsed = parseAndValidateStudentCSV(testCSVContent);
  console.log(`Total Valid Rows: ${parsed.totalValid} / ${parsed.rows.length}`);
  console.log(`Row 1 DOB: ${parsed.rows[0]?.dateOfBirth} | Password: ${parsed.rows[0]?.password}`);
  console.log(`Row 2 DOB: ${parsed.rows[1]?.dateOfBirth} | Password: ${parsed.rows[1]?.password}`);

  if (parsed.totalValid === 2 && parsed.rows[0].dateOfBirth === '2008-05-14' && parsed.rows[0].password === 'Aarav@2026') {
    console.log("[PASS] CSV Import parsing with DD/MM/YYYY Date of Birth and Portal Password working 100%!");
  } else {
    console.error("[FAIL] CSV Import parsing failed!");
    process.exit(1);
  }

  console.log("\nALL CSV DATE OF BIRTH TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

testCSVDODates().catch(err => {
  console.error("Test Error:", err);
  process.exit(1);
});
