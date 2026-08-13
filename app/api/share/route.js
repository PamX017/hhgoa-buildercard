import { NextResponse } from 'next/server';

/**
 * POST /api/share
 *
 * Accepts a PNG image upload, stores it in Vercel Blob (or falls back
 * to an in-memory URL), and returns a share URL for the OG page.
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image');

    if (!imageFile || !(imageFile instanceof Blob)) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Generate a unique share ID
    const shareId = generateId();

    let blobUrl;

    try {
      // Try Vercel Blob
      const { put } = await import('@vercel/blob');
      const result = await put(`shares/${shareId}.png`, imageFile, {
        access: 'public',
        contentType: 'image/png',
      });
      blobUrl = result.url;
    } catch {
      // Blob not configured — return a placeholder
      blobUrl = null;
    }

    // Store metadata in KV if available
    try {
      const { kv } = await import('@vercel/kv');
      await kv.set(`share:${shareId}`, {
        blobUrl,
        createdAt: Date.now(),
      }, { ex: 86400 * 7 }); // Expire after 7 days
    } catch {
      // KV not available
    }

    return NextResponse.json({
      shareId,
      shareUrl: `/g/${shareId}`,
      imageUrl: blobUrl,
    });
  } catch (err) {
    console.error('Share upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
