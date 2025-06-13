
// src/app/api/detect-fraud/route.ts
import { detectFraudulentSubmission } from '@/ai/flows/detect-fraudulent-submissions';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, phoneNumber, consent } = body;

    if (!fullName || !phoneNumber || consent === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await detectFraudulentSubmission({ fullName, phoneNumber, consent });

    return NextResponse.json(result);
  } catch (error) {
    console.error('--- Error in /api/detect-fraud endpoint ---');
    let errorDetailsForClient = 'An internal error occurred with the fraud detection service.';

    if (error instanceof Error) {
      console.error('Error Name:', error.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      errorDetailsForClient = error.message; // Send the actual message for better client-side context if desired
    } else {
      console.error('Non-Error object thrown in /api/detect-fraud:', error);
      errorDetailsForClient = 'An unexpected error occurred on the server.';
    }
    // The client will receive this JSON. Server logs will have more detailed stack traces.
    return NextResponse.json({ 
      error: 'Fraud detection service encountered an issue.', 
      details: errorDetailsForClient 
    }, { status: 500 });
  }
}

