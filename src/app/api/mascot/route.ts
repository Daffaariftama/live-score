import fs from 'fs';
import { NextResponse } from 'next/server';

export async function GET() {
  const filePath = '/Users/daffaariftama/.gemini/antigravity-ide/brain/8d500add-f577-448f-9341-e5db2a03ae67/media__1784175685523.png';
  try {
    if (!fs.existsSync(filePath)) {
      return new NextResponse('Mascot not found', { status: 404 });
    }
    const fileBuffer = fs.readFileSync(filePath);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new NextResponse('Error serving mascot', { status: 500 });
  }
}
