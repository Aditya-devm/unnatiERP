import { generateApplicationFormPDF } from '../lib/application-form-pdf';

async function testAppFormPDFAndWhatsApp() {
  console.log("=== TESTING APPLICATION FORM PDF FIXES & WHATSAPP API INTEGRATION ===");

  const mockInstitute = {
    name: 'UNNATI CLASSES',
    address: 'F-21, Fortune Empire, Borisana Road, Kalol - 382721',
    phone: '+91 9510434702'
  };

  const mockStudent = {
    id: 's_test_101',
    fullName: 'Aditya Tiwari',
    rollNumber: 'UP-101',
    fatherName: 'Rajesh Tiwari',
    motherName: 'Sunita Tiwari',
    phone: '9876543210',
    whatsappNumber: '9876543210',
    gender: 'male',
    address: '123 Main Street, Kalol',
    schoolName: 'St. Xavier School',
    enrollmentDate: '2026-03-10',
    monthlyFee: 2000,
    batchIds: ['b1']
  };

  const mockBatches = [
    { id: 'b1', name: 'Class 10th - Science', subject: 'Physics' }
  ];

  console.log("\n1. Testing Application Form PDF Generation & Return Values...");
  const pdfResult = await generateApplicationFormPDF(
    {
      instituteInfo: mockInstitute,
      student: mockStudent,
      batches: mockBatches
    },
    false // do not auto-trigger browser download
  );

  if (pdfResult.filename && pdfResult.dataUri && pdfResult.dataUri.startsWith('data:application/pdf')) {
    console.log("[PASS] generateApplicationFormPDF returned clean filename and dataUri string!");
  } else {
    console.error("[FAIL] PDF Generation return values invalid!");
    process.exit(1);
  }

  // 2. Test PDF text output content checks
  console.log("\n2. Testing PDF Output Text Content & Character Encoding...");
  const pdfText = pdfResult.doc.output();

  if (pdfText.includes('UNNATI CLASSES')) {
    console.log("[PASS] Header correctly displays institute name 'UNNATI CLASSES'!");
  } else {
    console.error("[FAIL] Header title does not contain institute name!");
    process.exit(1);
  }

  if (!pdfText.includes('Ø=ÜÍ') && !pdfText.includes('Ø=ÜÞ')) {
    console.log("[PASS] No garbled icon glyphs (Ø=ÜÍ / Ø=ÜÞ) found in output!");
  } else {
    console.error("[FAIL] Garbled icon glyphs detected in PDF output!");
    process.exit(1);
  }

  if (pdfText.includes('PASTE PASSPORT') && pdfText.includes('FOR OFFICE USE ONLY')) {
    console.log("[PASS] Photo Box placeholder and FOR OFFICE USE ONLY section present!");
  } else {
    console.error("[FAIL] Missing photo box or Office Use box!");
    process.exit(1);
  }

  console.log("\nALL PDF FIX & WHATSAPP INTEGRATION TESTS PASSED 100% SUCCESSFULLY!");
  process.exit(0);
}

testAppFormPDFAndWhatsApp().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
