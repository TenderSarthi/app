import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'TenderSarthi',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
}
