import jsPDF from 'jspdf';

export interface FeeReceiptPDFParams {
  instituteInfo: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
  payment: {
    id: string;
    receiptNumber: string;
    amountPaid: number;
    paymentDate: string;
    paymentMethod?: string;
    periodPaidFor?: string;
    batchId?: string | null;
    feeStructureId?: string | null;
    createdAt?: string;
  };
  student: {
    id: string;
    fullName: string;
    phone: string;
    parentName?: string;
    fatherName?: string;
    rollNumber?: string;
    rollNo?: string;
    batchIds?: string[];
    batchHistory?: any[];
    previousBatches?: any[];
    enrollmentDate?: string;
    currentBatchEnrollmentDate?: string;
  } | null;
  batches: Array<{ id: string; name: string }>;
  feeStructures: Array<{ id: string; name: string; amount?: number; frequency?: string; dueDayOfMonth?: number }>;
}

// Asynchronously load image file into HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Draw circular navy icon helper
function drawNavyIcon(doc: jsPDF, x: number, y: number, radius: number = 1.8) {
  doc.setFillColor(30, 27, 75); // Navy #1e1b4b
  doc.circle(x, y, radius, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(x, y, radius * 0.4, 'F');
}

// Format date to DD/MM/YYYY
export function formatDDMMYYYY(dateStr?: string): string {
  if (!dateStr) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  const trimmed = dateStr.trim();

  // If already DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(trimmed)) {
    return trimmed.replace(/-/g, '/');
  }

  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parts = trimmed.substring(0, 10).split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // Fallback date parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return dateStr;
}

// Format Due Date from Enrollment Date (e.g. 1st of Every Month)
function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

export function formatDueDateFromEnrollment(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return '1st of Every Month';

  let dayNum = 1;
  const trimmed = dateStr.trim();

  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  const dmYMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmYMatch) {
    dayNum = parseInt(dmYMatch[1], 10) || 1;
  } else {
    // Pattern: YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymdMatch) {
      dayNum = parseInt(ymdMatch[3], 10) || 1;
    } else {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        dayNum = d.getDate();
      }
    }
  }

  return `${getOrdinalSuffix(dayNum)} of Every Month`;
}

export async function generateFeeReceiptPDF(params: FeeReceiptPDFParams) {
  const { instituteInfo, payment, student, batches, feeStructures } = params;

  // Pre-load images from /assets/
  const logoImg = await loadImage('/assets/unnati-logo.png');
  const signatureImg = await loadImage('/assets/authorized-signature.png');

  // Initialize Landscape A5 PDF (210mm x 148mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5'
  });

  // =========================================================================
  // 1. HEADER SECTION (Y: 6mm - 31mm)
  // =========================================================================
  
  // Top-left: Logo Image
  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', 8, 6, 22, 22);
    } catch (e) {
      console.warn('Logo image add error:', e);
    }
  } else {
    // Fallback logo shape
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(8, 6, 22, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('U', 19, 20, { align: 'center' });
  }

  // Vertical Divider next to logo
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.line(33, 6, 33, 28);

  // Institute Information with bold large UNNATI CLASSES header
  const instName = 'UNNATI CLASSES';
  const instAddress = instituteInfo?.address || 'F-21, Fortune Empire, Borisana Road, Kalol - 382721';
  const instPhone = instituteInfo?.phone || '+91 9510434702';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16); // Large prominent bold header font
  doc.setTextColor(30, 27, 75); // Navy #1e1b4b
  doc.text(instName, 36, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(instAddress, 36, 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`Phone: ${instPhone}`, 36, 25);

  // Top-Right: Navy Banner with Gold Border and Angled Left Edge
  // Banner area: (144, 6) to (202, 28) with angled notch from (138, 28) to (144, 6)
  doc.setFillColor(30, 27, 75); // Navy #1e1b4b
  doc.rect(144, 6, 58, 22, 'F');
  doc.triangle(138, 28, 144, 28, 144, 6, 'F');

  // Gold border around angled banner
  doc.setDrawColor(217, 119, 6); // Gold #d97706
  doc.setLineWidth(0.6);
  doc.line(144, 6, 202, 6);
  doc.line(202, 6, 202, 28);
  doc.line(202, 28, 138, 28);
  doc.line(138, 28, 144, 6);

  // Text inside Navy Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('FEE RECEIPT', 170, 12, { align: 'center' });

  const formattedPaymentDate = formatDDMMYYYY(payment.paymentDate);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(251, 191, 36); // Gold/amber #fbbf24
  doc.text(`Receipt No:  ${payment.receiptNumber || 'UC-0001'}`, 146, 18);
  doc.text(`Date:  ${formattedPaymentDate}`, 146, 24);

  // Thin Gold Horizontal Rule below header
  doc.setDrawColor(217, 119, 6); // Gold #d97706
  doc.setLineWidth(0.5);
  doc.line(8, 31, 202, 31);

  // =========================================================================
  // 2. BODY SECTION - TWO COLUMNS (Y: 34mm - 60mm)
  // =========================================================================

  // Determine PAID Batch Name (strictly from payment.batchId or structure's batchId to respect previous batch payments)
  let paidBatchName = 'N/A';
  const targetBatchId = (payment as any).batchId || payment.batchId;

  if (targetBatchId) {
    const matchedBatch = batches.find((b) => b.id === targetBatchId);
    if (matchedBatch) {
      paidBatchName = matchedBatch.name;
    } else {
      const historyList = [...(student?.batchHistory || []), ...(student?.previousBatches || [])];
      const hEntry = historyList.find((h: any) => h.batchId === targetBatchId);
      if (hEntry) {
        paidBatchName = hEntry.batchName || 'Previous Batch';
      }
    }
  }

  if (paidBatchName === 'N/A' && student?.batchIds?.[0]) {
    const defaultBatch = batches.find((b) => b.id === student.batchIds![0]);
    if (defaultBatch) paidBatchName = defaultBatch.name;
  }

  const studentName = student?.fullName || 'N/A';
  const guardianName = student?.parentName || student?.fatherName || 'N/A';
  const phoneNo = student?.phone || 'N/A';
  const rollNo = student?.rollNumber || student?.rollNo || 'N/A';

  // Left Column (X: 8 to 102)
  // Item 1: Student Name
  drawNavyIcon(doc, 11, 38.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Student Name:', 15, 39);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(studentName, 37, 39);

  // Item 2: Batch
  drawNavyIcon(doc, 11, 46.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Batch:', 15, 47);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(paidBatchName, 37, 47);

  // Item 3: Guardian Name
  drawNavyIcon(doc, 11, 54.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Guardian Name:', 15, 55);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(guardianName, 39, 55);

  // Vertical Divider between columns
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(105, 34, 105, 58);

  // Right Column (X: 108 to 202)
  // Item 1: Phone
  drawNavyIcon(doc, 111, 38.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Phone:', 115, 39);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(phoneNo, 130, 39);

  // Item 2: Roll No.
  drawNavyIcon(doc, 111, 46.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Roll No.:', 115, 47);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(rollNo, 130, 47);

  // Item 3: Due Date (e.g. "20th of Every Month")
  const rawEnrollmentDate = student?.enrollmentDate || student?.currentBatchEnrollmentDate || payment.paymentDate;
  const dueDateFormatted = formatDueDateFromEnrollment(rawEnrollmentDate);
  drawNavyIcon(doc, 111, 54.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Due Date:', 115, 55);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dueDateFormatted, 130, 55);

  // =========================================================================
  // 3. FEE DETAILS TABLE (Y: 61mm - 93mm)
  // =========================================================================

  // Header Bar
  doc.setFillColor(30, 27, 75); // Navy #1e1b4b
  doc.roundedRect(8, 61, 194, 7, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('FEE DETAILS', 12, 65.5);
  doc.text('AMOUNT (INR)', 196, 65.5, { align: 'right' });

  // Resolve Fee Structure & Line Items
  const struct = feeStructures.find((f) => f.id === payment.feeStructureId);
  const structName = struct ? struct.name : 'Tuition Fee';
  const frequency = struct?.frequency ? struct.frequency.toUpperCase() : 'MONTHLY';
  const periodStr = payment.periodPaidFor || 'Tuition Fee';

  const feeLineDescription = `${structName}  •  ${frequency}  •  ${periodStr}`;

  // Line Item Row 1
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(feeLineDescription, 12, 74);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`INR ${payment.amountPaid.toLocaleString('en-IN')}`, 196, 74, { align: 'right' });

  // Divider under row
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(8, 79, 202, 79);

  // Highlighted Total Row (Y: 81mm - 90mm)
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(8, 81, 194, 9, 1, 1, 'F');
  doc.setDrawColor(217, 119, 6); // Gold border
  doc.setLineWidth(0.4);
  doc.roundedRect(8, 81, 194, 9, 1, 1, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 27, 75); // Navy
  doc.text('TOTAL AMOUNT PAID', 12, 87);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(22, 101, 52); // Emerald-800
  doc.text(`INR ${payment.amountPaid.toLocaleString('en-IN')}`, 196, 87, { align: 'right' });

  // =========================================================================
  // 4. FOOTER INFO STRIP (Y: 93mm - 106mm)
  // =========================================================================

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(8, 93, 194, 13, 1.5, 1.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(8, 93, 194, 13, 1.5, 1.5, 'D');

  // Due Date from Student Enrollment Date
  const dueDateStr = dueDateFormatted;

  // Item 1: Payment Date (X: 12)
  drawNavyIcon(doc, 12, 99.5, 1.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Payment Date', 15, 98);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(formattedPaymentDate, 15, 103);

  // Item 2: Due Date (X: 60)
  drawNavyIcon(doc, 60, 99.5, 1.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Due Date', 63, 98);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(dueDateStr, 63, 103);

  // Item 3: Payment Mode (X: 108)
  drawNavyIcon(doc, 108, 99.5, 1.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Payment Mode', 111, 98);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text((payment.paymentMethod || 'UPI').toUpperCase(), 111, 103);

  // Item 4: Fees of Month (X: 156)
  drawNavyIcon(doc, 156, 99.5, 1.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Fees of Month', 159, 98);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(payment.periodPaidFor || 'Current Month', 159, 103);

  // =========================================================================
  // 5. SIGN-OFF & FOOTER (Y: 109mm - 142mm)
  // =========================================================================

  // Bottom-Left: Thank you note
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // Indigo
  doc.text('Thank you!', 10, 118);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('for your trust in us.', 10, 124);

  // Bottom-Right: Authorized Signature & Blank Line
  // Blank Line (Left of signature line): X: 100 to X: 142
  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.4);
  doc.line(100, 129, 142, 129);

  // Authorized Signature Image (X: 158, Y: 112, W: 36, H: 15)
  if (signatureImg) {
    try {
      doc.addImage(signatureImg, 'PNG', 158, 112, 36, 15);
    } catch (e) {
      console.warn('Signature image add error:', e);
    }
  }

  // Signature Line: X: 150 to X: 198
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(150, 129, 198, 129);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Authorized Sign', 174, 134, { align: 'center' });

  // Save the PDF
  const filename = `Fee_Receipt_${payment.receiptNumber || 'RCPT'}.pdf`;
  doc.save(filename);
}
