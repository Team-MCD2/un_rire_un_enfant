import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---- Base64url helpers ----
function base64urlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...arr));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ---- PKCS8 wrapper for raw 32-byte EC private key ----
function buildPkcs8(raw32: Uint8Array): ArrayBuffer {
  const header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const result = new Uint8Array(header.length + raw32.length);
  result.set(header);
  result.set(raw32, header.length);
  return result.buffer;
}

// ---- VAPID JWT (ES256) ----
async function createVapidJwt(audience: string, subject: string, privateKeyB64url: string): Promise<string> {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);

  const headerB64 = uint8ArrayToBase64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payloadB64 = uint8ArrayToBase64url(enc.encode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: subject })));
  const unsigned = `${headerB64}.${payloadB64}`;

  const rawKey = base64urlToUint8Array(privateKeyB64url);
  const cryptoKey = await crypto.subtle.importKey('pkcs8', buildPkcs8(rawKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, enc.encode(unsigned)));

  // DER → raw r||s
  let rawSig: Uint8Array;
  if (sig.length === 64) {
    rawSig = sig;
  } else {
    const rLen = sig[3];
    const r = sig.slice(4, 4 + rLen);
    const sLen = sig[4 + rLen + 1];
    const s = sig.slice(4 + rLen + 2, 4 + rLen + 2 + sLen);
    rawSig = new Uint8Array(64);
    rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  }

  return `${unsigned}.${uint8ArrayToBase64url(rawSig)}`;
}

// ---- Web Push payload encryption (RFC 8291 / aes128gcm) ----
async function encryptPayload(
  plaintext: Uint8Array,
  subscriptionPublicKeyB64: string,
  authSecretB64: string,
): Promise<{ ciphertext: Uint8Array; localPublicKey: Uint8Array; salt: Uint8Array }> {
  const enc = new TextEncoder();

  // Import subscriber's public key (p256dh)
  const subscriberPubBytes = base64urlToUint8Array(subscriptionPublicKeyB64);
  const subscriberPubKey = await crypto.subtle.importKey('raw', subscriberPubBytes, { name: 'ECDH', namedCurve: 'P-256' }, true, []);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberPubKey }, localKeyPair.privateKey, 256));

  // Auth secret
  const authSecret = base64urlToUint8Array(authSecretB64);

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF: PRK = HKDF-Extract(auth_secret, ecdh_secret)
  const prkKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits']);

  // IKM via HKDF
  const ikmInfo = concatBuffers(enc.encode('WebPush: info\0'), subscriberPubBytes, localPublicKey);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: ikmInfo }, prkKey, 256));

  // Import IKM for final HKDF
  const ikmKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);

  // Derive CEK (Content Encryption Key) and nonce
  const cekInfo = enc.encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = enc.encode('Content-Encoding: nonce\0');

  const cek = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, ikmKey, 128));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, ikmKey, 96));

  // Add padding delimiter (0x02 = final record)
  const padded = concatBuffers(plaintext, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

  // Build aes128gcm header: salt(16) + rs(4) + keyIdLen(1) + keyId(65) + ciphertext
  const rs = 4096;
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, rs, false);

  const ciphertext = concatBuffers(
    salt,
    rsBytes,
    new Uint8Array([localPublicKey.length]),
    localPublicKey,
    encrypted,
  );

  return { ciphertext, localPublicKey, salt };
}

function concatBuffers(...bufs: Uint8Array[]): Uint8Array {
  const total = bufs.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of bufs) { result.set(b, offset); offset += b.length; }
  return result;
}

// ---- Main handler ----
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, title, body, link, tag } = await req.json();
    console.log('[send-push] Request for user:', userId);

    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create in-app notification (using service role to bypass RLS)
    await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        type: tag || 'message',
        title: title || 'Notification',
        body: body || null,
        link: link || null,
      }),
    });

    // Fetch push subscriptions
    const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=*`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const subscriptions = await subsRes.json();
    console.log('[send-push] Found', subscriptions?.length ?? 0, 'subscriptions');

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions, in-app notification created' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payloadJson = JSON.stringify({
      title: title || 'Rire pour 1 enfant',
      body: body || 'Nouvelle notification',
      tag: tag || 'default',
      data: { url: link || '/' },
    });

    const enc = new TextEncoder();
    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const endpoint = sub.endpoint;
        const url = new URL(endpoint);
        const audience = `${url.protocol}//${url.host}`;

        // Encrypt payload using subscriber's keys
        const { ciphertext } = await encryptPayload(
          enc.encode(payloadJson),
          sub.p256dh,
          sub.auth_key,
        );

        const jwt = await createVapidJwt(audience, 'mailto:contact@rirepour1enfant.fr', VAPID_PRIVATE_KEY);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'Content-Length': String(ciphertext.length),
            'TTL': '86400',
            'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
          },
          body: ciphertext,
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
          console.log(`[send-push] Sent to ${sub.id}`);
        } else if (response.status === 404 || response.status === 410) {
          // Expired subscription
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          });
          failed++;
          console.log(`[send-push] Removed expired subscription ${sub.id}`);
        } else {
          const text = await response.text();
          console.error(`[send-push] Failed ${sub.id}: ${response.status} ${text}`);
          failed++;
        }
      } catch (err) {
        console.error(`[send-push] Error for ${sub.id}:`, err);
        failed++;
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-push] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
