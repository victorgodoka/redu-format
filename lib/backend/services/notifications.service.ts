import { getPool } from "../db/client.ts";
import {
  NotificationsRepository,
  type NewNotification,
  type NotificationReader,
  type NotificationRow,
} from "../repositories/notifications.repository.ts";

export type { NotificationReader, NotificationRow };

function repo() {
  return new NotificationsRepository(getPool());
}

/** The reader a signed-in admin session represents. Every admin sees the same global feed. */
export function adminReader(discordUserId: string): NotificationReader {
  return { audience: "admin", readerId: discordUserId };
}

/** A player reads global player alerts plus the ones addressed to them. */
export function playerReader(playerId: string): NotificationReader {
  return { audience: "player", readerId: playerId, playerId };
}

export async function listInbox(reader: NotificationReader): Promise<NotificationRow[]> {
  return repo().list(reader);
}

export async function countUnread(reader: NotificationReader): Promise<number> {
  return repo().countUnread(reader);
}

/**
 * Opening a message is what marks it read - there is no separate button, same
 * as a mail client. Returns the message as it was *before* the read, so the
 * detail pane can still show it highlighted on the click that opened it.
 */
export async function openMessage(
  reader: NotificationReader,
  id: string,
): Promise<NotificationRow | null> {
  const message = await repo().find(reader, id);
  if (!message) return null;
  if (!message.read) await repo().markRead(reader, id);
  return message;
}

export async function notify(input: NewNotification): Promise<boolean> {
  return repo().insertIfNew(input);
}
