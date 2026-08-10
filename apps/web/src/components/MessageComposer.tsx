import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { CirclePlus, Send } from 'lucide-react';

import { MESSAGE_MAX_LENGTH } from '@nestcord/shared';

interface MessageComposerProps {
  channelName: string;
  /** Wired to the send-message mutation once the messaging API lands. */
  onSend?: (content: string) => void;
}

export function MessageComposer({ channelName, onSend }: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!trimmed) return;
    onSend?.(trimmed);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="px-4 pt-1 pb-6">
      <div className="bg-surface-600 flex items-end gap-2 rounded-lg px-4 py-2.5">
        <button
          type="button"
          aria-label="Add an attachment"
          className="text-content-300 mb-0.5 hover:text-white"
        >
          <CirclePlus className="size-5" aria-hidden />
        </button>

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          aria-label={`Message #${channelName}`}
          placeholder={`Message #${channelName}`}
          className="placeholder:text-content-500 max-h-40 flex-1 resize-none bg-transparent py-0.5 outline-none"
        />

        <button
          type="submit"
          disabled={!trimmed}
          aria-label="Send message"
          className="text-content-300 mb-0.5 enabled:hover:text-white disabled:opacity-40"
        >
          <Send className="size-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}
