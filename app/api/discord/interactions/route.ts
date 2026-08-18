import { NextResponse } from 'next/server';
import { verifyKey } from 'discord-interactions';

export async function POST(request: Request) {
  const publicKey = process.env.DISCORD_BOT_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json({ error: 'Missing public key' }, { status: 500 });
  }

  // 1. Get verification headers
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing headers' }, { status: 401 });
  }

  // 2. Read the raw request body as text
  const rawBody = await request.text();

  // 3. Verify the request signature
  const isValidRequest = await verifyKey(rawBody, signature, timestamp, publicKey);

  if (!isValidRequest) {
    return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 });
  }

  // 4. Parse the verified body
  const interaction = JSON.parse(rawBody);

  // Type 1: Discord PING health check
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 }); // Responds with PONG
  }

  // Type 2: Slash command handler (e.g., /ping)
  if (interaction.type === 2) {
    const { name } = interaction.data;

    if (name === 'ping') {
      return NextResponse.json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: { content: 'Pong from Next.js BFF!' },
      });
    }
  }

  return NextResponse.json({ error: 'Unknown interaction type' }, { status: 400 });
}
