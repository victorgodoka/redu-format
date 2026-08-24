function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const discordConfig = {
  clientId: requiredEnv("DISCORD_CLIENT_ID"),
  clientSecret: requiredEnv("DISCORD_CLIENT_SECRET"),
  botToken: requiredEnv("DISCORD_BOT_TOKEN"),

  guildId: requiredEnv("DISCORD_GUILD_ID"),
  modRoleId: requiredEnv("DISCORD_MOD_ROLE_ID"),

  redirectUri: requiredEnv("DISCORD_REDIRECT_URI"),

  /**
   * Where Discord sends a *player* back to (the site sign-in, no role check),
   * as opposed to the admin callback above. Defaults to /login/callback on the
   * same origin as the admin one, so only the Discord app's redirect list has
   * to learn about it; set DISCORD_PLAYER_REDIRECT_URI to override.
   */
  playerRedirectUri:
    process.env.DISCORD_PLAYER_REDIRECT_URI ??
    new URL("/login/callback", requiredEnv("DISCORD_REDIRECT_URI")).toString(),

  oauthUrl: requiredEnv("DISCORD_OAUTH_URL"),
  apiUrl: requiredEnv("DISCORD_API_URL"),
} as const;
