import crypto from "crypto";

export function verifyHmacSHA256({
  payload,
  headerSignature,
  secret,
}: {
  payload: string;
  headerSignature: string | null;
  secret: string | undefined;
}) {
  if (!secret || !headerSignature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(headerSignature));
  } catch {
    return false;
  }
}

export function requireBearer(req: Request, expected: string | undefined) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!expected || !auth) return false;
  const token = auth.replace(/^Bearer\s+/i, "");
  return token === expected;
}


