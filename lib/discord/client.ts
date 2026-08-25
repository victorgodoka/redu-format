import { discordConfig } from "./config";
import type {
  DiscordGuildMember,
  DiscordOAuthTokenResponse,
  DiscordUser,
} from "./types";

async function discordFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${discordConfig.apiUrl}${path}`,
    {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const error = await response.text();

    throw new Error(
      `Discord API error (${response.status}): ${error}`,
    );
  }

  return response.json() as Promise<T>;
}

/** `redirectUri` must be byte-identical to the one the authorize step used, or Discord rejects the exchange. */
export async function exchangeCode(
  code: string,
  redirectUri: string = discordConfig.redirectUri,
): Promise<DiscordOAuthTokenResponse> {
  const body = new URLSearchParams({
    client_id: discordConfig.clientId,
    client_secret: discordConfig.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(
    `${discordConfig.apiUrl}/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const error = await response.text();

    throw new Error(
      `Discord OAuth error (${response.status}): ${error}`,
    );
  }

  return response.json() as Promise<DiscordOAuthTokenResponse>;
}

export async function getCurrentUser(
  accessToken: string,
): Promise<DiscordUser> {
  return discordFetch<DiscordUser>("/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Absolute CDN url for a user's avatar, or null when they never set one (the
 * default silhouette is Discord's, and nothing here renders it - players are
 * shown by their Nexus avatar).
 */
export function avatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

export async function getGuildMember(
  userId: string,
): Promise<DiscordGuildMember> {
  return discordFetch<DiscordGuildMember>(
    `/guilds/${discordConfig.guildId}/members/${userId}`,
    {
      headers: {
        Authorization: `Bot ${discordConfig.botToken}`,
      },
    },
  );
}
