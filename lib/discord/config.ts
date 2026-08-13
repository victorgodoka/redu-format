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

  oauthUrl: requiredEnv("DISCORD_OAUTH_URL"),
  apiUrl: requiredEnv("DISCORD_API_URL"),
} as const;
