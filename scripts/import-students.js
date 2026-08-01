const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error("Error: Missing Firebase credentials in .env.local");
    process.exit(1);
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();
const auth = admin.auth();

// Robust CSV Parser (handles newlines and quotes)
function parseCSV(content) {
    const result = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped double quote
                cell += '"';
                i++;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(cell.trim());
            cell = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            row.push(cell.trim());
            if (row.some(Boolean) || row.length > 1) {
                result.push(row);
            }
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }
    
    if (cell.trim() || row.length > 0) {
        row.push(cell.trim());
        result.push(row);
    }
    
    return result;
}

// Clean empty fields to null
const valOrNull = (str) => (str && str.trim()) ? str.trim() : null;

// Normalize batch/class names to match system presets (e.g., "Class 10 CBSE")
function normalizeBatchName(name) {
    if (!name) return null;
    let normalized = name.trim().replace(/\s+/g, ' ');
    
    // Match "Class New" -> "New Class" (standalone)
    if (/class\s+new/i.test(normalized)) {
        return 'New Class';
    }
    // Match "Diploma" -> "Diploma" (standalone)
    if (/diploma/i.test(normalized)) {
        return 'Diploma';
    }
    
    // Map board typos
    const boardMap = {
        'CBSE': 'CBSE',
        'GSEB': 'GSEB',
        'GBSE': 'GSEB', // Correct typo
        'ICSE': 'ICSE'
    };

    // Case-insensitive regex to match "class [number] [board]"
    const match = normalized.match(/class\s+(\d+)\s+(cbse|gseb|gbse|icse)/i);
    if (match) {
        let std = match[1];
        let boardInput = match[2].toUpperCase();
        let board = boardMap[boardInput] || boardInput;
        return `Class ${std} ${board}`;
    }
    
    return normalized;
}

// Parse the Batches promotion history column
function parseBatchesHistory(batchesStr) {
    if (!batchesStr) return [];
    // Split by newlines, handling multiple batch lines
    const lines = batchesStr.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    return lines.map(line => {
        // Expected line: "Class 7 GSEB ● 01/07/2025 - 18/04/2026" or "Class 8 GSEB ● 15/06/2026 - Running"
        const parts = line.split('●').map(p => p.trim());
        const rawBatchName = parts[0];
        const batchName = normalizeBatchName(rawBatchName) || rawBatchName;
        
        const dateRange = parts[1] || '';
        const dateParts = dateRange.split('-').map(d => d.trim());
        const startDate = valOrNull(dateParts[0]);
        const endDateStr = dateParts[1] || 'Running';
        const endDate = endDateStr.toLowerCase() === 'running' ? null : valOrNull(endDateStr);
        const status = endDate === null ? 'running' : 'completed';
        
        return {
            batchName,
            startDate,
            endDate,
            status
        };
    });
}

// Main execution function
async function runImport() {
    try {
        console.log("----------------------------------------");
        console.log("Starting Unnati Powerprep Student Import Pipeline");
        console.log("----------------------------------------");

        // 1. Database Cleanup
        console.log("Phase 1: Cleaning up existing student records...");
        
        // Fetch all student documents from users collection
        const studentsSnapshot = await db.collection('users').where('role', '==', 'student').get();
        const studentUids = studentsSnapshot.docs.map(doc => doc.id);
        
        console.log(`Found ${studentUids.length} existing student profiles in Firestore.`);

        if (studentUids.length > 0) {
            // Delete from Firebase Auth in chunks of 1000
            console.log("Deleting students from Firebase Authentication...");
            const chunks = [];
            for (let i = 0; i < studentUids.length; i += 1000) {
                chunks.push(studentUids.slice(i, i + 1000));
            }
            
            for (const chunk of chunks) {
                await auth.deleteUsers(chunk);
            }
            console.log(`Deleted ${studentUids.length} users from Firebase Auth.`);

            // Delete Firestore user documents
            console.log("Deleting student documents from Firestore 'users' collection...");
            const userBatch = db.batch();
            studentsSnapshot.docs.forEach(doc => {
                userBatch.delete(doc.ref);
            });
            await userBatch.commit();
            console.log("Cleared Firestore 'users' collection of students.");
        }

        // Delete all records in other collections
        const collectionsToClear = ['fees', 'attendance', 'exams', 'student-requests'];
        for (const colName of collectionsToClear) {
            console.log(`Clearing collection '${colName}'...`);
            const colSnapshot = await db.collection(colName).get();
            if (!colSnapshot.empty) {
                const batch = db.batch();
                colSnapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`Deleted ${colSnapshot.size} documents from '${colName}'.`);
            } else {
                console.log(`Collection '${colName}' is already empty.`);
            }
        }
        
        console.log("Database clean-up finished successfully!");
        console.log("----------------------------------------");

        // 2. Read and Parse students.csv
        console.log("Phase 2: Parsing CSV file...");
        const csvPath = path.resolve(__dirname, '../students.csv');
        if (!fs.existsSync(csvPath)) {
            console.error(`Error: File not found at ${csvPath}`);
            process.exit(1);
        }
        
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const parsedData = parseCSV(csvContent);
        
        if (parsedData.length < 2) {
            console.error("Error: CSV file contains no data rows.");
            process.exit(1);
        }

        const headers = parsedData[0];
        const dataRows = parsedData.slice(1);
        console.log(`Parsed ${dataRows.length} students from students.csv.`);

        // Map data rows to objects
        const students = dataRows.map(row => {
            const student = {};
            headers.forEach((header, index) => {
                student[header.trim()] = row[index] || '';
            });
            return student;
        });

        // 3. Create Users
        console.log("Phase 3: Creating and importing students...");
        let successCount = 0;
        let errorCount = 0;

        for (const student of students) {
            if (!student.Name) {
                console.log("Skipping empty row");
                continue;
            }

            try {
                const name = student.Name.trim();
                const rollNo = valOrNull(student.RollNumber);
                const primaryNo = student.PrimaryNumber ? student.PrimaryNumber.trim().replace(/[^0-9]/g, '') : '';
                
                // Generate a unique email since they don't have emails in the CSV
                const nameClean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const suffix = rollNo ? rollNo : nameClean;
                const email = `student_${primaryNo || 'nopho'}_${suffix}@unnatipowerprep.com`;
                const password = student.Password || 'Unnati@123';
                
                // Parse batch history
                const batchHistory = parseBatchesHistory(student.Batches);
                
                // Determine current batch assignment
                // Use the latest batch in their history, or fallback to Standard column preset
                let currentStandard = null;
                const latestBatch = batchHistory[batchHistory.length - 1];
                if (latestBatch) {
                    currentStandard = latestBatch.batchName;
                } else if (student.Standard) {
                    currentStandard = `Class ${student.Standard.trim()} CBSE`;
                }
                
                // Normalizing current standard to match presets if possible
                if (currentStandard) {
                    currentStandard = normalizeBatchName(currentStandard) || currentStandard;
                }

                // 1. Create Firebase Auth User
                const userRecord = await auth.createUser({
                    email: email,
                    password: password,
                    displayName: name,
                });

                // 2. Prepare Firestore document details
                const primary10 = primaryNo ? primaryNo.slice(-10) : null;
                const secondaryNo = student.SecondaryNumber ? student.SecondaryNumber.trim().replace(/[^0-9]/g, '') : null;
                const secondary10 = secondaryNo ? secondaryNo.slice(-10) : null;

                const userData = {
                    name,
                    email,
                    password, // Plain-text saved for lookup/verification fallback
                    role: 'student',
                    instCode: 'HPBBJA', // Default Institute Code
                    fatherName: valOrNull(student.Father),
                    motherName: valOrNull(student.Mother),
                    dob: valOrNull(student.DOB),
                    gender: valOrNull(student.Gender),
                    address: valOrNull(student.Address),
                    aadharNumber: valOrNull(student.AadharNumber),
                    caste: valOrNull(student.Caste),
                    schoolName: valOrNull(student.SchoolName),
                    rollNo: rollNo,
                    standard: currentStandard,
                    batchId: currentStandard,
                    primaryNumber: valOrNull(student.PrimaryNumber),
                    primaryNumber10Digit: primary10,
                    secondaryNumber: valOrNull(student.SecondaryNumber),
                    secondaryNumber10Digit: secondary10,
                    batchHistory: batchHistory,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // Remove fields that are null (to respect "ignore the empty cells")
                Object.keys(userData).forEach(key => {
                    if (userData[key] === null) {
                        delete userData[key];
                    }
                });

                // Save to Firestore under the Auth UID
                await db.collection('users').doc(userRecord.uid).set(userData);
                
                console.log(`[SUCCESS] Registered ${name} | Email: ${email} | Batch: ${currentStandard || 'None'}`);
                successCount++;

            } catch (err) {
                console.error(`[ERROR] Failed to register ${student.Name || 'Unknown student'}:`, err.message);
                errorCount++;
            }
        }

        console.log("----------------------------------------");
        console.log("Import Summary:");
        console.log(`Successfully imported: ${successCount} students.`);
        console.log(`Failed to import: ${errorCount} students.`);
        console.log("----------------------------------------");
        process.exit(0);

    } catch (e) {
        console.error("Critical error running student import pipeline:", e);
        process.exit(1);
    }
}

runImport();
