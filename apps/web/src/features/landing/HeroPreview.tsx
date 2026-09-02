import { Hash } from 'lucide-react';

import { heroPreview } from './landing-content';

/**
 * A still frame of the app. Its job is to show a room with people in it rather
 * than describe one.
 */
export function HeroPreview() {
  return (
    <div
      aria-hidden
      className="border-border bg-surface-800 rounded-2xl border shadow-2xl shadow-black/40"
    >
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <span className="bg-dnd/80 size-2.5 rounded-full" />
        <span className="bg-idle/80 size-2.5 rounded-full" />
        <span className="bg-online/80 size-2.5 rounded-full" />
        <span className="text-content-500 ml-2 flex items-center gap-1 text-xs">
          <Hash className="size-3.5" />
          living-room
        </span>
      </div>

      <ul className="space-y-4 px-4 py-5">
        {heroPreview.map((line) => (
          <li key={`${line.author}-${line.time}`} className="flex gap-3">
            <span className="bg-surface-600 text-content-300 grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold uppercase">
              {line.initials}
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-content-100 text-sm font-medium">{line.author}</span>
                <span className="text-content-500 text-[0.7rem]">{line.time}</span>
              </span>
              <span className="text-content-300 block text-sm">{line.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="px-4 pb-5">
        <div className="bg-surface-600 text-content-500 rounded-xl px-4 py-2.5 text-sm">
          Say something…
        </div>
      </div>
    </div>
  );
}
