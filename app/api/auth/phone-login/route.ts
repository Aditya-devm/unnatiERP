import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
    try {
        const { phone, password } = await req.json();

        if (!phone || !password) {
            return NextResponse.json({ error: 'Mobile number and password are required' }, { status: 400 });
        }

        const phoneClean = phone.trim().replace(/[^0-9]/g, '');
        const last10Digits = phoneClean.slice(-10);

        if (last10Digits.length < 10) {
            return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
        }

        const db = getAdminDb();
        const usersSnapshot = await db.collection('users')
            .where('primaryNumber10Digit', '==', last10Digits)
            .get();

        if (usersSnapshot.empty) {
            return NextResponse.json({ error: 'No account found with this mobile number' }, { status: 404 });
        }

        // Match plain text password in Firestore (handles duplicates/siblings sharing same number)
        const matchedDoc = usersSnapshot.docs.find(doc => {
            const data = doc.data();
            return data.password === password;
        });

        if (!matchedDoc) {
            return NextResponse.json({ error: 'Invalid mobile number or password' }, { status: 401 });
        }

        const email = matchedDoc.data().email;
        return NextResponse.json({ email });

    } catch (error: any) {
        console.error('Phone login lookup error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
