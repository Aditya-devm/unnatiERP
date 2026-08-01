import { jsPDF } from 'jspdf';

interface StudentData {
  id: string;
  fullName: string;
  phone: string;
  parentPhone?: string;
  photoUrl?: string | null;
  enrollmentDate?: string;
  batchIds?: string[];
  status?: string;
}

interface BatchData {
  id: string;
  name: string;
  subject: string;
}

// Convert image URL to Data URL via canvas
const urlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch (err) {
    console.error('Error loading image to data URL:', err);
    return null;
  }
};

// Render single ID card on jsPDF document page
const drawIdCard = async (
  doc: jsPDF,
  student: StudentData,
  batches: BatchData[],
  startX: number = 10,
  startY: number = 10
) => {
  const width = 85; // Standard CR80 width in mm
  const height = 125; // Standard ID Card height in mm

  // Card Outer Border & Shadow Frame
  doc.setDrawColor(30, 41, 59); // Slate-800
  doc.setFillColor(15, 23, 42); // Slate-900 fill background
  doc.roundedRect(startX, startY, width, height, 4, 4, 'FD');

  // Header Banner Background Gradient (Deep Indigo)
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.roundedRect(startX, startY, width, 24, 4, 4, 'F');
  doc.rect(startX, startY + 16, width, 8, 'F'); // Square bottom of header

  // Header Institute Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('UNNATI CLASSES', startX + width / 2, startY + 10, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('POWERPREP ACADEMY', startX + width / 2, startY + 16, { align: 'center' });

  // Photo Box (Center Photo)
  const photoSize = 28;
  const photoX = startX + (width - photoSize) / 2;
  const photoY = startY + 28;

  doc.setDrawColor(99, 102, 241); // Indigo-500 border
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 3, 3, 'FD');

  if (student.photoUrl) {
    const photoData = await urlToDataUrl(student.photoUrl);
    if (photoData) {
      try {
        doc.addImage(photoData, 'PNG', photoX + 1, photoY + 1, photoSize - 2, photoSize - 2);
      } catch (e) {
        // Fallback text avatar if image CORS fails
      }
    }
  }

  if (!student.photoUrl) {
    doc.setTextColor(129, 140, 248);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(
      (student.fullName || 'S').charAt(0).toUpperCase(),
      photoX + photoSize / 2,
      photoY + photoSize / 2 + 3,
      { align: 'center' }
    );
  }

  // Student Full Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(student.fullName || 'Student Name', startX + width / 2, photoY + photoSize + 8, {
    align: 'center'
  });

  // Student ID Badge
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(165, 180, 252);
  doc.text(
    `ID: STU-${student.id.substring(0, 8).toUpperCase()}`,
    startX + width / 2,
    photoY + photoSize + 13,
    { align: 'center' }
  );

  // Meta Information Table
  const metaY = photoY + photoSize + 18;
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate-400

  // Filter batch names
  const studentBatches = batches
    .filter((b) => student.batchIds && student.batchIds.includes(b.id))
    .map((b) => b.name)
    .join(', ');
  const batchDisplay = studentBatches || 'General Batch';

  doc.setFont('helvetica', 'bold');
  doc.text('Batch:', startX + 8, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(241, 245, 249);
  doc.text(batchDisplay.substring(0, 28), startX + 25, metaY);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'bold');
  doc.text('Enrolled:', startX + 8, metaY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(241, 245, 249);
  doc.text(student.enrollmentDate || 'Active', startX + 25, metaY + 6);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'bold');
  doc.text('Contact:', startX + 8, metaY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(241, 245, 249);
  doc.text(student.phone || student.parentPhone || 'N/A', startX + 25, metaY + 12);

  // Dynamic QR Code Rendering
  const qrSize = 22;
  const qrX = startX + (width - qrSize) / 2;
  const qrY = metaY + 17;

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    student.id
  )}`;
  const qrDataUrl = await urlToDataUrl(qrApiUrl);

  if (qrDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1, 1, 'F');
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.error('Error drawing QR code:', e);
    }
  }

  // Footer Contact Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(startX, startY + height - 12, width, 12, 'F');

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text(
    'F-21, Fortune empire, Kalol - 382721 | Ph: +91 9510434702',
    startX + width / 2,
    startY + height - 5,
    { align: 'center' }
  );
};

// 1. Generate Single Student ID Card PDF
export const generateSingleIdCardPDF = async (
  student: StudentData,
  batches: BatchData[]
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [105, 145] // Compact card single-page size
  });

  await drawIdCard(doc, student, batches, 10, 10);
  doc.save(`ID_Card_${(student.fullName || 'Student').replace(/\s+/g, '_')}.pdf`);
};

// 2. Generate Bulk Batch ID Cards PDF
export const generateBulkIdCardsPDF = async (
  students: StudentData[],
  batches: BatchData[],
  title: string = 'Batch'
) => {
  if (students.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4' // A4 page format (2 cards per page side-by-side or stacked)
  });

  // Render cards 2 per A4 page (top and bottom)
  for (let i = 0; i < students.length; i++) {
    if (i > 0 && i % 2 === 0) {
      doc.addPage();
    }

    const isSecondCardOnPage = i % 2 === 1;
    const startX = 62.5; // Centered horizontally on A4 (width 210mm)
    const startY = isSecondCardOnPage ? 150 : 15;

    await drawIdCard(doc, students[i], batches, startX, startY);
  }

  doc.save(`Bulk_ID_Cards_${title.replace(/\s+/g, '_')}.pdf`);
};
