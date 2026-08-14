import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { CirclePlus, Reply, Send, X } from 'lucide-react';

import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_TYPES,
  MESSAGE_MAX_ATTACHMENTS,
  MESSAGE_MAX_LENGTH,
  type Conversation,
  type MessageAttachment,
  type PublicUser,
} from '@nestcord/shared';

import { useSendMessage, useUploadAttachment } from '@/features/messages/use-messages';
import { useUiStore } from '@/stores/ui-store';
import { conversationMessages } from './api';
import { conversationTitle } from './conversation-title';

/**
 * The box you type in, in a DM.
 *
 * Same behaviour as the channel composer — Enter sends, files upload as they are
 * picked — without the permission questions, because being in a conversation is the
 * only permission a DM has. No typing indicator: that is a channel feature today.
 */
export function DmComposer({
  conversation,
  author,
}: {
  conversation: Conversation;
  author: PublicUser;
}) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<MessageAttachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const replyTarget = useUiStore((state) => state.replyTargets[conversation.id]);
  const cancelReply = useUiStore((state) => state.cancelReply);

  const transport = conversationMessages(conversation.id);
  const send = useSendMessage(transport, author);
  const upload = useUploadAttachment(transport);

  const title = conversationTitle(conversation, author.id);
  const trimmed = draft.trim();
  const isSendable = trimmed.length > 0 || pending.length > 0;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!isSendable) return;

    send.submit({
      ...(trimmed ? { content: trimmed } : {}),
      ...(replyTarget ? { replyToId: replyTarget.messageId } : {}),
      ...(pending.length > 0 ? { attachmentIds: pending.map((attachment) => attachment.id) } : {}),
    });

    setDraft('');
    setPending([]);
    cancelReply(conversation.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = [...(event.target.files ?? [])].slice(
      0,
      MESSAGE_MAX_ATTACHMENTS - pending.length,
    );
    // Let the same file be picked again after it is removed.
    event.target.value = '';

    for (const file of chosen) {
      const attachment = await upload.mutateAsync(file).catch(() => null);
      if (attachment) setPending((current) => [...current, attachment]);
    }
  }

  return (
    <form onSubmit={submit} className="px-4 pt-1 pb-6">
      {replyTarget && (
        <div className="bg-surface-700 text-content-300 border-border flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-1.5 text-xs">
          <Reply className="size-3.5" aria-hidden />
          <span>
            Replying to <span className="text-content-100">{replyTarget.author}</span>
          </span>
          <button
            type="button"
            onClick={() => cancelReply(conversation.id)}
            aria-label="Cancel reply"
            className="hover:text-content-100 ml-auto"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <ul className="bg-surface-700 border-border flex flex-wrap gap-2 border border-b-0 px-4 py-2 text-xs">
          {pending.map((attachment) => (
            <li
              key={attachment.id}
              className="bg-surface-600 flex items-center gap-1.5 rounded-md px-2 py-1"
            >
              <span className="max-w-40 truncate">{attachment.filename}</span>
              <button
                type="button"
                onClick={() =>
                  setPending((current) =>
                    current.filter((candidate) => candidate.id !== attachment.id),
                  )
                }
                aria-label={`Remove ${attachment.filename}`}
                className="text-content-400 hover:text-content-100"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="bg-surface-600 border-border flex items-end gap-2.5 rounded-2xl border px-4 py-3">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={upload.isPending || pending.length >= MESSAGE_MAX_ATTACHMENTS}
          aria-label="Add an attachment"
          className="text-content-300 hover:text-content-100 mb-0.5 transition-colors disabled:opacity-40"
        >
          <CirclePlus className="size-5" aria-hidden />
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ATTACHMENT_MIME_TYPES.join(',')}
          onChange={(event) => void handleFiles(event)}
          className="hidden"
        />

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          aria-label={`Message ${title}`}
          placeholder={`Message ${title}…`}
          className="placeholder:text-content-500 max-h-40 flex-1 resize-none bg-transparent py-0.5 leading-relaxed outline-none"
        />

        <button
          type="submit"
          disabled={!isSendable}
          aria-label="Send message"
          className="text-content-300 enabled:hover:text-primary mb-0.5 transition-colors disabled:opacity-40"
        >
          <Send className="size-5" aria-hidden />
        </button>
      </div>

      {upload.isPending && <p className="text-content-400 mt-1 text-xs">Uploading…</p>}

      {upload.isError && (
        <p role="alert" className="text-destructive mt-1 text-xs">
          That file was not accepted. Images and PDFs up to{' '}
          {Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB.
        </p>
      )}

      {send.isError && (
        <p role="alert" className="text-destructive mt-1 text-xs">
          Your message did not send. {send.error.message}
        </p>
      )}
    </form>
  );
}
