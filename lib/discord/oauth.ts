import { discordConfig } from "./config";

export function getDiscordLoginUrl(): string {
  const url = new URL(discordConfig.oauthUrl);

  url.searchParams.set("client_id", discordConfig.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", discordConfig.redirectUri);
  url.searchParams.set("scope", "identify");

  return url.toString();
}