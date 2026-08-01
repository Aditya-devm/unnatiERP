import jsPDF from 'jspdf';
import { formatDDMMYYYY } from './fee-receipt-pdf';

export interface ApplicationFormPDFParams {
  instituteInfo: {
    name?: string;
    instituteName?: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
  student: {
    id: string;
    fullName: string;
    rollNumber?: string | null;
    rollNo?: string | null;
    fatherName?: string | null;
    parentName?: string | null;
    motherName?: string | null;
    phone?: string | null;
    whatsappNumber?: string | null;
    parentPhone?: string | null;
    gender?: string | null;
    address?: string | null;
    schoolName?: string | null;
    enrollmentDate?: string | null;
    currentBatchEnrollmentDate?: string | null;
    monthlyFee?: number | null;
    customFeeAmount?: number | null;
    batchIds?: string[];
    photoUrl?: string | null;
    pendingPhotoUrl?: string | null;
    email?: string | null;
  };
  batches: Array<{ id: string; name: string; subject?: string }>;
}

// Asynchronously load image into HTMLImageElement
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

/**
 * Generate Portrait A4 Application Form PDF
 * Returns { filename, dataUri, doc } and downloads file if autoSave is true.
 */
export async function generateApplicationFormPDF(
  params: ApplicationFormPDFParams,
  autoSave: boolean = true
) {
  const { instituteInfo, student, batches } = params;

  // Initialize Portrait A4 jsPDF (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;

  // Category 1 Fix: Real institute info from institutes document (NEVER student's name)
  const instName = (instituteInfo?.name || (instituteInfo as any)?.instituteName || 'UNNATI CLASSES').toUpperCase();
  const instAddress = instituteInfo?.address || (instituteInfo as any)?.instAddress || 'F-21, Fortune Empire, Borisana Road, Kalol - 382721';
  const instPhone = instituteInfo?.phone || (instituteInfo as any)?.instPhone || '+91 9510434702';

  // Real student info
  const studentName = student.fullName || 'N/A';
  const rollNo = student.rollNumber || student.rollNo || student.id || 'N/A';
  const fatherName = student.fatherName || student.parentName || 'N/A';
  const motherName = student.motherName || 'N/A';
  const studentPhone = student.phone || 'N/A';
  const whatsappNum = student.whatsappNumber || student.parentPhone || student.phone || 'N/A';
  const rawGender = (student.gender || 'male').toLowerCase();
  const fullAddress = student.address || 'N/A';
  const schoolName = student.schoolName || 'N/A';

  // Batch details
  const primaryBatchId = student.batchIds?.[0];
  const matchedBatch = batches.find((b) => b.id === primaryBatchId);
  const batchName = matchedBatch ? `${matchedBatch.name}${matchedBatch.subject ? ` (${matchedBatch.subject})` : ''}` : 'General Batch';

  const monthlyFeeVal = (student.monthlyFee !== undefined && student.monthlyFee !== null) ? student.monthlyFee : ((student.customFeeAmount !== undefined && student.customFeeAmount !== null) ? student.customFeeAmount : 2000);
  const rawEnrollment = student.currentBatchEnrollmentDate || student.enrollmentDate;
  const enrollmentDateStr = formatDDMMYYYY(rawEnrollment || undefined);

  // Load logo
  const logoImg = await loadImage('/assets/unnati-logo.png').then((img) => img || loadImage('/logo.png'));

  // ---------------------------------------------------------
  // 1. NAVY & GOLD DECORATIVE BORDER (Portrait A4)
  // ---------------------------------------------------------
  // Outer Navy Border (Margin 8mm)
  doc.setDrawColor(30, 27, 75); // Navy #1e1b4b
  doc.setLineWidth(0.8);
  doc.rect(8, 8, 194, 281);

  // Corner Flourish Accent Top-Left
  doc.setFillColor(30, 27, 75);
  doc.triangle(8, 8, 18, 8, 8, 18, 'F');
  doc.setFillColor(217, 119, 6); // Gold #d97706
  doc.triangle(8, 8, 14, 8, 8, 14, 'F');

  // Thin Gold Inner Border (Margin 9.5mm)
  doc.setDrawColor(217, 119, 6); // Gold #d97706
  doc.setLineWidth(0.35);
  doc.rect(9.5, 9.5, 191, 278);

  // ---------------------------------------------------------
  // 2. HEADER SECTION (Top Logo, Institute Name, Photo Box)
  // ---------------------------------------------------------
  // Top-left Logo
  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', 13, 13, 22, 22);
    } catch (e) {
      console.warn('Failed to render logo image in PDF:', e);
    }
  }

  // Category 1 Fix: Institute Name prominently displayed in bold (NOT student name)
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 27, 75); // Navy #1e1b4b
  doc.text(instName, 38, 20);

  // Thin Gold Divider
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.4);
  doc.line(38, 22.5, 155, 22.5);

  // Category 2 Fix: Vector icon shapes for Address & Phone (no emoji font garble)
  // Vector Location Pin Icon (Navy Circle + Gold Accent Dot)
  doc.setFillColor(30, 27, 75);
  doc.circle(39, 26, 1.2, 'F');
  doc.setFillColor(217, 119, 6);
  doc.circle(39, 26, 0.5, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // Slate #475569
  doc.text(instAddress, 42, 27);

  // Vector Phone Icon (Navy Circle + Gold Accent Dot)
  doc.setFillColor(30, 27, 75);
  doc.circle(39, 31, 1.2, 'F');
  doc.setFillColor(217, 119, 6);
  doc.circle(39, 31, 0.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Phone: ${instPhone}`, 42, 32);

  // Category 4 Fix: Top-Right Photo Box (Passport Size: 36mm x 44mm - Always Blank / Placeholder text)
  const photoX = 160;
  const photoY = 13;
  const photoW = 36;
  const photoH = 44;

  doc.setDrawColor(30, 27, 75);
  doc.setLineWidth(0.5);
  doc.rect(photoX, photoY, photoW, photoH);

  doc.setFillColor(248, 250, 252);
  doc.rect(photoX + 0.5, photoY + 0.5, photoW - 1, photoH - 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PASTE PASSPORT', photoX + photoW / 2, photoY + 20, { align: 'center' });
  doc.text('SIZE PHOTO HERE', photoX + photoW / 2, photoY + 25, { align: 'center' });

  // ---------------------------------------------------------
  // 3. CENTERED TITLE: "APPLICATION FORM" WITH FLOURISHES
  // ---------------------------------------------------------
  const titleY = 46;
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 27, 75);
  doc.text('APPLICATION FORM', pageWidth / 2, titleY, { align: 'center' });

  // Gold Flourish Dividers on Left & Right
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.6);
  doc.line(45, titleY - 1.5, 72, titleY - 1.5);
  doc.line(138, titleY - 1.5, 165, titleY - 1.5);

  doc.setFillColor(217, 119, 6);
  doc.circle(72, titleY - 1.5, 0.8, 'F');
  doc.circle(138, titleY - 1.5, 0.8, 'F');

  // ---------------------------------------------------------
  // 4. SECTION 1: STUDENT INFORMATION
  // ---------------------------------------------------------
  let secY = 53;

  // Navy Pill Header
  doc.setFillColor(30, 27, 75);
  doc.roundedRect(13, secY, 184, 7, 3.5, 3.5, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('STUDENT INFORMATION', 18, secY + 4.8);

  // Content Container Box (Category 3 Fix: generous spacing)
  const infoBoxY = secY + 9;
  const infoBoxH = 78;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(13, infoBoxY, 184, infoBoxH, 3, 3, 'FD');

  // 2-Column Data Grid
  let gridY = infoBoxY + 7;
  const leftX = 17;
  const rightX = 108;
  const colW = 85;

  const drawFieldRow = (label1: string, val1: string, label2: string, val2: string, curY: number) => {
    // Col 1
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 27, 75);
    doc.text(label1, leftX, curY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(val1, leftX + 32, curY, { maxWidth: colW - 32 });

    // Col 2
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 27, 75);
    doc.text(label2, rightX, curY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(val2, rightX + 32, curY, { maxWidth: colW - 32 });
  };

  // Row 1: Student Name | Roll No.
  drawFieldRow('Student Name:', studentName, 'Roll No.:', rollNo, gridY);
  gridY += 10;

  // Row 2: Guardian Name | Mother Name
  drawFieldRow('Guardian Name:', fatherName, 'Mother Name:', motherName, gridY);
  gridY += 10;

  // Row 3: Phone Number | WhatsApp Number
  drawFieldRow('Phone Number:', studentPhone, 'WhatsApp No.:', whatsappNum, gridY);
  gridY += 10;

  // Row 4: Gender Checkboxes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 27, 75);
  doc.text('Gender:', leftX, gridY);

  const isMale = rawGender === 'male';
  const isFemale = rawGender === 'female';
  const isOther = !isMale && !isFemale;

  const maleMark = isMale ? '[ ✓ ] Male' : '[   ] Male';
  const femaleMark = isFemale ? '[ ✓ ] Female' : '[   ] Female';
  const otherMark = isOther ? '[ ✓ ] Other' : '[   ] Other';

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${maleMark}     ${femaleMark}     ${otherMark}`, leftX + 32, gridY);

  gridY += 10;

  // Row 5: Full Address (Full width)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text('Address:', leftX, gridY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(fullAddress, leftX + 32, gridY, { maxWidth: 140 });

  gridY += 14;

  // Row 6: School Name | Batch
  drawFieldRow('School Name:', schoolName, 'Batch:', batchName, gridY);

  // ---------------------------------------------------------
  // 5. SECTION 2: BATCH & FEE CATEGORY DETAILS
  // ---------------------------------------------------------
  secY = infoBoxY + infoBoxH + 6;

  // Navy Pill Header
  doc.setFillColor(30, 27, 75);
  doc.roundedRect(13, secY, 184, 7, 3.5, 3.5, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('BATCH & FEE CATEGORY DETAILS', 18, secY + 4.8);

  // Table Container
  const tableY = secY + 9;
  const tableW = 184;

  // Table Header Row (Category 2 Fix: "Amount (Rs.)" instead of garbled Rupee glyph)
  doc.setFillColor(30, 27, 75);
  doc.rect(13, tableY, tableW, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Batch & Fee Category', 16, tableY + 4.8);
  doc.text('Fee Type', 80, tableY + 4.8);
  doc.text('Amount (Rs.)', 120, tableY + 4.8);
  doc.text('Start Date', 160, tableY + 4.8);

  // Table Data Row (Category 2 Fix: "Rs. 2000" cleanly rendered)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.rect(13, tableY + 7, tableW, 9, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(batchName, 16, tableY + 12.8, { maxWidth: 60 });
  doc.text('Monthly', 80, tableY + 12.8);
  doc.text(`Rs. ${monthlyFeeVal}`, 120, tableY + 12.8);
  doc.text(enrollmentDateStr, 160, tableY + 12.8);

  // ---------------------------------------------------------
  // 6. SECTION 3: DECLARATION
  // ---------------------------------------------------------
  secY = tableY + 20;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(13, secY, 184, 38, 3, 3, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 27, 75);
  doc.text('DECLARATION', 17, secY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    'I hereby declare that all the information provided above is true and correct to the best of my knowledge and belief.',
    17,
    secY + 12,
    { maxWidth: 176 }
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Date: ____ / ____ / ________', 17, secY + 22);

  // Blank Signature Lines (Left & Right)
  const sigY = secY + 30;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(17, sigY, 75, sigY);
  doc.line(125, sigY, 183, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Parent / Guardian Signature', 17, sigY + 4);
  doc.text('Authorized Sign', 125, sigY + 4);

  // ---------------------------------------------------------
  // 7. SECTION 4: FOR OFFICE USE ONLY BOX (Category 4 Fix: Fully Blank Fields)
  // ---------------------------------------------------------
  secY += 42;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(30, 27, 75);
  doc.setLineWidth(0.5);
  doc.roundedRect(13, secY, 184, 32, 3, 3, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 27, 75);
  doc.text('FOR OFFICE USE ONLY', 17, secY + 6);

  let offY = secY + 13;
  // Admission No. | Login ID (Blank underline fields)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 27, 75);
  doc.text('Admission No.:', 17, offY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('_______________________', 43, offY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text('Login ID:', 108, offY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('_______________________', 128, offY);

  offY += 9;
  // Password | Remark (Blank underline fields)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text('Password:', 17, offY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('_______________________', 43, offY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text('Remark:', 108, offY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('_______________________', 128, offY);

  // ---------------------------------------------------------
  // 8. BOTTOM BANNER
  // ---------------------------------------------------------
  const bannerY = 277;
  doc.setFillColor(30, 27, 75);
  doc.roundedRect(13, bannerY, 184, 7, 2, 2, 'F');

  doc.setFont('times', 'bolditalic');
  doc.setFontSize(10.5);
  doc.setTextColor(217, 119, 6); // Gold #d97706
  doc.text('Unnati Today, Success Tomorrow.', pageWidth / 2, bannerY + 4.8, { align: 'center' });

  // Save PDF file if requested
  const filename = `Application_Form_${studentName.replace(/[^a-zA-Z0-9]/g, '_')}_${rollNo}.pdf`;
  if (autoSave) {
    doc.save(filename);
  }

  const dataUri = doc.output('datauristring');
  return { filename, dataUri, doc };
}
