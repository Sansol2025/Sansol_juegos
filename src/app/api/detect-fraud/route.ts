
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
    console.error('Error in detect-fraud endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
