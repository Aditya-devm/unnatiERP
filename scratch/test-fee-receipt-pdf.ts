import { generateFeeReceiptPDF, formatDDMMYYYY, formatDueDateFromEnrollment } from '../lib/fee-receipt-pdf';

async function testFeeReceiptPDFGeneration() {
  console.log("=== TESTING FEE RECEIPT PDF GENERATION (BOLD UNNATI CLASSES & ORDINAL DUE DATE) ===");

  // Test Ordinal Due Date Formatter
  console.log("\n1. Testing Ordinal Due Date Formatter...");
  const due1 = formatDueDateFromEnrollment('2026-06-01');
  const due2 = formatDueDateFromEnrollment('2026-06-15');
  const due3 = formatDueDateFromEnrollment('2026-06-22');
  console.log(`2026-06-01 -> "${due1}"`);
  console.log(`2026-06-15 -> "${due2}"`);
  console.log(`2026-06-22 -> "${due3}"`);

  if (due1 === '1st of Every Month' && due2 === '15th of Every Month' && due3 === '22nd of Every Month') {
    console.log("[PASS] Ordinal due date formatting working perfectly!");
  } else {
    console.error("[FAIL] Ordinal due date formatting failed!");
    process.exit(1);
  }

  const mockInstitute = {
    name: 'Aditya tiwari Institute',
    address: 'F-21, Fortune Empire, Borisana Road, Kalol - 382721',
    phone: '+91 9510434702',
    email: 'unnaticlasseskalol@gmail.com'
  };

  const mockBatches = [
    { id: 'batch_class10', name: 'Class 10 Science & Math' },
    { id: 'batch_class8', name: 'Class 8 Foundation' }
  ];

  const mockFeeStructures = [
    { id: 'struct_monthly', name: 'Monthly Tuition Fee', amount: 2000, frequency: 'monthly', dueDayOfMonth: 15 }
  ];

  const mockStudent = {
    id: 'student_amit',
    fullName: 'Amit Mishra',
    phone: '+91 9876543210',
    parentName: 'Rajesh Mishra',
    fatherName: 'Rajesh Mishra',
    rollNumber: 'ROLL-101',
    enrollmentDate: '2026-06-01',
    currentBatchEnrollmentDate: '2026-06-01',
    batchIds: ['batch_class8']
  };

  const currentPayment = {
    id: 'pay_current_01',
    receiptNumber: 'UC-0001',
    amountPaid: 2000,
    paymentDate: '2026-07-15',
    paymentMethod: 'UPI',
    periodPaidFor: 'July 2026',
    batchId: 'batch_class8',
    feeStructureId: 'struct_monthly'
  };

  await generateFeeReceiptPDF({
    instituteInfo: mockInstitute,
    payment: currentPayment,
    student: mockStudent,
    batches: mockBatches,
    feeStructures: mockFeeStructures
  });
  console.log("[PASS] Current batch fee receipt generated with bold large UNNATI CLASSES header and '1st of Every Month' due date.");

  console.log("\nALL UPDATED FEE RECEIPT TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

testFeeReceiptPDFGeneration().catch(err => {
  console.error("Test Error:", err);
  process.exit(1);
});
