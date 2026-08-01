import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { message, rating } = await req.json();

        if (!message || !rating) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Database logic removed. In a real app, we might send this to an email or external log.
        console.log('Feedback received:', { message, rating });

        return NextResponse.json(
            { message: 'Feedback received successfully' },
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
    }
}
