import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instituteId, studentId, studentPhone, studentName, documentDataUri, filename } = body;

    const targetInstId = instituteId || 'ZA7wk0M2oXtrl3rd5FY3';

    // 1. Fetch WhatsApp Cloud API credentials from Firestore settings or environment
    const settingsRef = doc(db, 'institutes', targetInstId, 'settings', 'whatsapp');
    const settingsSnap = await getDoc(settingsRef);
    const settingsData = settingsSnap.exists() ? settingsSnap.data() : null;

    const apiToken = settingsData?.apiToken || process.env.WHATSAPP_API_TOKEN || '';
    const phoneNumberId = settingsData?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    const isConfigured = Boolean(apiToken.trim() && phoneNumberId.trim());

    const nowIso = new Date().toISOString();
    const notificationsCol = collection(db, 'institutes', targetInstId, 'notifications');

    // 2. If API credentials are missing / not configured
    if (!isConfigured) {
      // Log attempt into notifications collection as pending_config
      const notificationDoc = await addDoc(notificationsCol, {
        recipientStudentId: studentId || null,
        recipientName: studentName || 'Student',
        recipientPhone: studentPhone || 'N/A',
        channel: 'whatsapp_document',
        message: `Attempted to send PDF document ${filename || 'Application_Form.pdf'} via WhatsApp API`,
        status: 'pending_config',
        sentAt: nowIso,
        createdAt: nowIso,
        error: 'WhatsApp Cloud API credentials (API Token & Phone Number ID) are not configured.'
      });

      return NextResponse.json(
        {
          success: false,
          configured: false,
          notificationId: notificationDoc.id,
          error: 'WhatsApp API credentials are not configured yet. Please configure Meta WhatsApp Cloud API credentials in Institute Settings.'
        },
        { status: 400 }
      );
    }

    // 3. Clean recipient phone number
    const cleanDigits = (studentPhone || '').replace(/\D/g, '');
    const recipientPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

    if (!recipientPhone || recipientPhone.length < 10) {
      await addDoc(notificationsCol, {
        recipientStudentId: studentId || null,
        recipientName: studentName || 'Student',
        recipientPhone: studentPhone || 'N/A',
        channel: 'whatsapp_document',
        message: `Failed to send PDF document ${filename || 'Application_Form.pdf'} via WhatsApp API`,
        status: 'failed',
        sentAt: nowIso,
        createdAt: nowIso,
        error: 'Invalid recipient WhatsApp phone number.'
      });

      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: 'Invalid recipient WhatsApp phone number.'
        },
        { status: 400 }
      );
    }

    // 4. Send document via Meta WhatsApp Cloud API
    const metaUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const metaResponse = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'document',
        document: {
          link: documentDataUri.startsWith('http') ? documentDataUri : undefined,
          filename: filename || `Application_Form_${studentName ? studentName.replace(/\s+/g, '_') : 'Student'}.pdf`,
          caption: `Official Application Form for ${studentName || 'Student'} - UNNATI CLASSES`
        }
      })
    });

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      const errMsg = metaData.error?.message || 'Meta WhatsApp Cloud API request failed.';
      const notificationDoc = await addDoc(notificationsCol, {
        recipientStudentId: studentId || null,
        recipientName: studentName || 'Student',
        recipientPhone: recipientPhone,
        channel: 'whatsapp_document',
        message: `Failed to send PDF document ${filename || 'Application_Form.pdf'} via WhatsApp API`,
        status: 'failed',
        sentAt: nowIso,
        createdAt: nowIso,
        error: errMsg
      });

      return NextResponse.json(
        {
          success: false,
          configured: true,
          notificationId: notificationDoc.id,
          error: `WhatsApp API Error: ${errMsg}`
        },
        { status: 500 }
      );
    }

    // 5. Successful send log
    const notificationDoc = await addDoc(notificationsCol, {
      recipientStudentId: studentId || null,
      recipientName: studentName || 'Student',
      recipientPhone: recipientPhone,
      channel: 'whatsapp_document',
      message: `Successfully sent PDF document ${filename || 'Application_Form.pdf'} to WhatsApp ${recipientPhone}`,
      status: 'sent',
      sentAt: nowIso,
      createdAt: nowIso,
      whatsappMessageId: metaData.messages?.[0]?.id || null
    });

    return NextResponse.json({
      success: true,
      configured: true,
      notificationId: notificationDoc.id,
      whatsappMessageId: metaData.messages?.[0]?.id || null,
      status: 'sent'
    });
  } catch (err: any) {
    console.error('Error sending WhatsApp document:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
