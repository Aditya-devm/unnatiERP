export interface ParsedStudentRow {
  rowIndex: number;
  rollNumber: string;
  fullName: string;
  fatherName: string;
  motherName: string;
  aadharNumber: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  password?: string;
  parentName: string;
  parentPhone: string;
  address: string;
  enrollmentDate: string;
  monthlyFee: number;
  status: 'active' | 'inactive' | 'dropped';
  isValid: boolean;
  errors: string[];
}

// Helper to normalize any date input (DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD) into standard YYYY-MM-DD
export function normalizeDateToYYYYMMDD(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return '';
  const trimmed = dateStr.trim();

  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  const dmYMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmYMatch) {
    const day = dmYMatch[1].padStart(2, '0');
    const month = dmYMatch[2].padStart(2, '0');
    const year = dmYMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Pattern: YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

// Helper to format YYYY-MM-DD into DD/MM/YYYY for CSV Export & Display
export function formatDDMMYYYY(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parts = trimmed.substring(0, 10).split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return trimmed;
}

// 1. Download Comprehensive Sample CSV Template for Student Import
export function downloadSampleStudentCSV() {
  const headers = [
    'Roll Number',
    'Full Name*',
    'Father Name*',
    'Mother Name*',
    'Aadhar Number',
    'Date of Birth (DD/MM/YYYY)*',
    'Gender*',
    'Student Phone*',
    'WhatsApp Number*',
    'Email*',
    'Portal Password',
    'Parent Name',
    'Parent Phone',
    'Address*',
    'Enrollment Date (DD/MM/YYYY)',
    'Monthly Fee*',
    'Status'
  ];

  const sampleRows = [
    [
      'UP-101',
      'Aarav Sharma',
      'Rajesh Sharma',
      'Sunita Sharma',
      '123456789012',
      '14/05/2008',
      'male',
      '+91 9876543210',
      '+91 9876543210',
      'aarav.sharma@example.com',
      'Aarav@2026',
      'Rajesh Sharma',
      '+91 9876543210',
      'Sector 22, Kalol, Gujarat',
      '01/07/2026',
      '2500',
      'active'
    ],
    [
      'UP-102',
      'Ananya Patel',
      'Vikram Patel',
      'Meena Patel',
      '987654321098',
      '20/11/2009',
      'female',
      '+91 9876543211',
      '+91 9876543211',
      'ananya.patel@example.com',
      'Ananya@2026',
      'Vikram Patel',
      '+91 9876543211',
      'Station Road, Kalol, Gujarat',
      '01/07/2026',
      '2000',
      'active'
    ]
  ];

  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'student_import_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 2. Export Selected Students Data to CSV (All Fields Included)
export function exportStudentsToCSV(students: any[], filename = 'selected_students_export.csv') {
  if (!students || students.length === 0) return;

  const headers = [
    'Roll Number',
    'Full Name',
    'Father Name',
    'Mother Name',
    'Aadhar Number',
    'Date of Birth (DD/MM/YYYY)',
    'Gender',
    'Student Phone',
    'WhatsApp Number',
    'Email',
    'Portal Password',
    'Parent Name',
    'Parent Phone',
    'Address',
    'Enrollment Date (DD/MM/YYYY)',
    'Monthly Fee',
    'Status'
  ];

  const rows = students.map((s) => [
    s.rollNumber || '',
    s.fullName || '',
    s.fatherName || s.parentName || '',
    s.motherName || '',
    s.aadharNumber || '',
    formatDDMMYYYY(s.dateOfBirth),
    s.gender || 'male',
    s.phone || '',
    s.whatsappNumber || s.parentPhone || s.phone || '',
    s.email || '',
    s.password || '',
    s.parentName || s.fatherName || '',
    s.parentPhone || s.whatsappNumber || s.phone || '',
    s.address || '',
    formatDDMMYYYY(s.enrollmentDate),
    s.monthlyFee !== undefined ? s.monthlyFee : 2000,
    s.status || 'active'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helper to parse CSV line containing double quotes cleanly
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// 3. Parse & Validate Uploaded Comprehensive Student CSV File
export function parseAndValidateStudentCSV(csvText: string): {
  rows: ParsedStudentRow[];
  totalValid: number;
  totalInvalid: number;
} {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) {
    return { rows: [], totalValid: 0, totalInvalid: 0 };
  }

  // Parse header line to detect column indices dynamically
  const headerCols = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const passIdx = headerCols.findIndex(h => h.includes('password'));

  const dataLines = lines.slice(1);
  const parsedRows: ParsedStudentRow[] = [];
  let totalValid = 0;
  let totalInvalid = 0;

  dataLines.forEach((line, idx) => {
    const cols = parseCSVLine(line);
    const errors: string[] = [];

    const rollNumber = cols[0] || '';
    const fullName = cols[1] || '';
    const fatherName = cols[2] || '';
    const motherName = cols[3] || '';
    const aadharNumber = cols[4] || '';
    const dateOfBirth = cols[5] || '';
    const gender = (cols[6] || 'male').toLowerCase();
    const phone = cols[7] || '';
    const whatsappNumber = cols[8] || phone;
    const email = (cols[9] || '').toLowerCase();

    let password = '';
    let parentName = '';
    let parentPhone = '';
    let address = '';
    let enrollmentDate = '';
    let monthlyFeeRaw = '2000';
    let statusRaw = 'active';

    if (passIdx !== -1) {
      // 17-column format with explicit password column
      password = cols[passIdx] || '';
      parentName = cols[passIdx + 1] || fatherName;
      parentPhone = cols[passIdx + 2] || whatsappNumber || phone;
      address = cols[passIdx + 3] || '';
      enrollmentDate = cols[passIdx + 4] || new Date().toISOString().substring(0, 10);
      monthlyFeeRaw = cols[passIdx + 5] || '2000';
      statusRaw = (cols[passIdx + 6] || 'active').toLowerCase();
    } else if (cols.length >= 17) {
      // Positional 17-column format
      password = cols[10] || '';
      parentName = cols[11] || fatherName;
      parentPhone = cols[12] || whatsappNumber || phone;
      address = cols[13] || '';
      enrollmentDate = cols[14] || new Date().toISOString().substring(0, 10);
      monthlyFeeRaw = cols[15] || '2000';
      statusRaw = (cols[16] || 'active').toLowerCase();
    } else {
      // Legacy 16-column format without password column
      password = '';
      parentName = cols[10] || fatherName;
      parentPhone = cols[11] || whatsappNumber || phone;
      address = cols[12] || '';
      enrollmentDate = cols[13] || new Date().toISOString().substring(0, 10);
      monthlyFeeRaw = cols[14] || '2000';
      statusRaw = (cols[15] || 'active').toLowerCase();
    }

    // Validations
    const normalizedDOB = normalizeDateToYYYYMMDD(dateOfBirth);
    const normalizedEnrollment = normalizeDateToYYYYMMDD(enrollmentDate) || new Date().toISOString().substring(0, 10);

    if (!fullName.trim()) errors.push('Full Name is required');
    if (!fatherName.trim()) errors.push('Father Name is required');
    if (!motherName.trim()) errors.push('Mother Name is required');
    if (!normalizedDOB) errors.push('Date of Birth (DD/MM/YYYY) is required');
    if (!phone.trim()) errors.push('Student Phone is required');
    if (!email.trim() || !email.includes('@')) errors.push('Valid Email is required');
    if (!address.trim()) errors.push('Address is required');

    const monthlyFee = parseFloat(monthlyFeeRaw);
    if (isNaN(monthlyFee) || monthlyFee < 0) {
      errors.push('Monthly Fee must be a valid number');
    }

    const status: 'active' | 'inactive' | 'dropped' = ['active', 'inactive', 'dropped'].includes(statusRaw)
      ? (statusRaw as any)
      : 'active';

    const isValid = errors.length === 0;
    if (isValid) totalValid++;
    else totalInvalid++;

    parsedRows.push({
      rowIndex: idx + 2, // 1-indexed including header
      rollNumber: rollNumber.trim(),
      fullName: fullName.trim(),
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      aadharNumber: aadharNumber.trim(),
      dateOfBirth: normalizedDOB,
      gender: ['male', 'female', 'other'].includes(gender) ? gender : 'male',
      phone: phone.trim(),
      whatsappNumber: whatsappNumber.trim(),
      email: email.trim(),
      password: password.trim(),
      parentName: parentName.trim() || fatherName.trim(),
      parentPhone: parentPhone.trim() || phone.trim(),
      address: address.trim(),
      enrollmentDate: normalizedEnrollment,
      monthlyFee: isNaN(monthlyFee) ? 2000 : monthlyFee,
      status,
      isValid,
      errors
    });
  });

  return {
    rows: parsedRows,
    totalValid,
    totalInvalid
  };
}
