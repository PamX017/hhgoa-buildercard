import { NextResponse } from 'next/server';

/**
 * POST /api/builder-id
 *
 * Generates a unique Builder ID in the format #HH-GOA-XXXX.
 * Uses Vercel KV for uniqueness, falls back to random generation
 * if KV is not configured.
 */
export async function POST() {
  try {
    // Try to use Vercel KV if configured
    let kv;
    try {
      const kvModule = await import('@vercel/kv');
      kv = kvModule.kv;
      // Test connection
      await kv.ping();
    } catch {
      // KV not configured — generate without uniqueness guarantee
      kv = null;
    }

    if (kv) {
      // Generate with uniqueness via KV Set
      for (let attempt = 0; attempt < 100; attempt++) {
        const num = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        const id = `#HH-GOA-${num}`;

        // Check if already taken
        const exists = await kv.sismember('builder-ids', id);
        if (!exists) {
          // Reserve it
          await kv.sadd('builder-ids', id);
          return NextResponse.json({ builderId: id });
        }
      }

      // All attempts failed (very unlikely)
      return NextResponse.json(
        { error: 'Could not generate unique ID. Please try again.' },
        { status: 503 }
      );
    } else {
      // Fallback: random without KV
      const num = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const id = `#HH-GOA-${num}`;
      return NextResponse.json({ builderId: id });
    }
  } catch (err) {
    console.error('Builder ID generation error:', err);
    // Fallback
    const num = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const id = `#HH-GOA-${num}`;
    return NextResponse.json({ builderId: id });
  }
}
