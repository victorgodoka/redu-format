import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "admin_session";

/** Short-lived hop that carries the protected page an admin was turned away from across the Discord round trip. */
export const ADMIN_NEXT_COOKIE = "admin_next";

const SESSION_DURATION = 60 * 60 * 24; // 1 day

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("Missing AUTH_SECRET");
  }

  return new TextEncoder().encode(secret);
}

export type AdminSession = {
  userId: string;
  /** Discord @handle (DiscordUser.username), not the display name. */
  username: string;
  /** Discord display name (global_name), falls back to username when unset. */
  displayName: string;
  /** Dueling Nexus token linked from the admin dashboard, if any. */
  nexusToken?: string;
};

export async function createAdminSession(
  session: AdminSession,
): Promise<void> {
  const token = await new SignJWT({
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    ...(session.nexusToken ? { nexusToken: session.nexusToken } : {}),
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

/**
 * Split out from getAdminSession so middleware can verify the same cookie:
 * next/headers' cookies() is not available in Middleware, only request.cookies
 * is, so the two call sites read the token differently but must trust it the
 * same way.
 */
export async function verifyAdminToken(
  token: string,
): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      getSecret(),
      {
        algorithms: ["HS256"],
      },
    );

    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
      displayName:
        typeof payload.displayName === "string" ? payload.displayName : payload.username,
      nexusToken:
        typeof payload.nexusToken === "string" ? payload.nexusToken : undefined,
    };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifyAdminToken(token);
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE);
}
