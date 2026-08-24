import Link from "next/link";
import type { ReactNode } from "react";
import Markdown from "@/components/ui/Markdown";
import { formatDate, formatTime } from "@/lib/events";
import styles from "./Inbox.module.css";

export type InboxMessage = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

/**
 * Two-pane mail client: the message list on the left, the open message on the
 * right. Selection is a query parameter rather than client state, so a message
 * is linkable, survives a reload, and the whole inbox stays a server component.
 */
export default function Inbox({
  messages,
  selected,
  basePath,
  emptyMessage,
  children,
}: {
  messages: InboxMessage[];
  /** The open message, already marked read by the page that resolved it. */
  selected: InboxMessage | null;
  /** Where a list item links to; the message id rides along as `?id=`. */
  basePath: string;
  emptyMessage: string;
  /** The payload view for the open message - a deck diff, a registered list. */
  children?: ReactNode;
}) {
  return (
    <div className={styles.inbox}>
      <ul className={styles.list} aria-label="Messages">
        {messages.length === 0 ? <li className={styles.empty}>{emptyMessage}</li> : null}

        {messages.map((message) => {
          const open = message.id === selected?.id;
          return (
            <li key={message.id}>
              <Link
                className={styles.item}
                href={`${basePath}?id=${message.id}`}
                data-open={open || undefined}
                data-unread={!message.read || undefined}
                aria-current={open ? "true" : undefined}
                scroll={false}
              >
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.itemTitle}>{message.title}</span>
                <span className={styles.itemMeta}>
                  {formatDate(message.createdAt)}
                  {!message.read ? <span className={styles.srOnly}> (unread)</span> : null}
                </span>
                <span className={styles.itemPreview}>{message.body}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <article className={styles.reader} aria-live="polite">
        {selected ? (
          <>
            <header className={styles.readerHead}>
              <h2 className={styles.readerTitle}>{selected.title}</h2>
              <p className={styles.readerMeta}>
                <time dateTime={selected.createdAt}>
                  {formatDate(selected.createdAt)} - {formatTime(selected.createdAt)}
                </time>
              </p>
            </header>
            <Markdown className={styles.readerBody} source={selected.body} />
            {children}
          </>
        ) : (
          <p className={styles.placeholder}>
            {messages.length === 0 ? emptyMessage : "Select a message to read it."}
          </p>
        )}
      </article>
    </div>
  );
}
