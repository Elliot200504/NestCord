import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import type { ErrorLogEntry } from '@nestcord/shared';

import { QueryError } from '@/components/QueryError';
import { SettingsSection } from '@/features/settings/SettingsPrimitives';
import { cn } from '@/lib/utils';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { flattenErrors, useErrorLog, useErrorLookup } from './use-error-log';

/**
 * The error log, for the admins configured in ADMIN_EMAILS.
 *
 * Users are shown an apology and a reference code; this is where that code turns
 * back into what actually happened. Newest first, because the error somebody is
 * asking about is almost always the last one.
 */
export function ErrorLogSection() {
  const [reference, setReference] = useState('');
  const access = useAdminAccess();

  return (
    <SettingsSection
      title="Error log"
      description="Failures users were not shown the detail of. Search by the reference they quoted."
    >
      {access.data?.isAdmin === false ? (
        // The API refuses the log itself; this only avoids answering a refusal with
        // "could not load", which reads like a fault rather than a decision.
        <p className="text-content-500 text-sm">
          This page is for administrators. Ask one of them to look up a reference for you.
        </p>
      ) : (
        <>
          <ReferenceSearch reference={reference} onChange={setReference} />
          {reference.trim().length > 0 ? <ReferenceResult reference={reference} /> : <ErrorList />}
        </>
      )}
    </SettingsSection>
  );
}

/** The log itself: a page of errors, newest first, and a way to ask for more. */
function ErrorList() {
  const log = useErrorLog();
  const errors = flattenErrors(log.data?.pages);

  if (log.isPending) return <p className="text-content-500 text-sm">Loading the error log…</p>;

  if (log.isError) return <QueryError what="the error log" onRetry={() => void log.refetch()} />;

  if (errors.length === 0) {
    return (
      <p className="text-content-500 text-sm">
        Nothing has failed unexpectedly. This list stays empty until something does.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-border bg-surface-800 border-border divide-y rounded-2xl border">
        {errors.map((entry) => (
          <ErrorRow key={entry.id} entry={entry} />
        ))}
      </ul>

      {log.hasNextPage && (
        <button
          type="button"
          onClick={() => void log.fetchNextPage()}
          disabled={log.isFetchingNextPage}
          className="text-primary mt-3 flex items-center gap-2 text-sm hover:underline disabled:opacity-50"
        >
          {log.isFetchingNextPage && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Load older errors
        </button>
      )}
    </>
  );
}

/**
 * The box a quoted code goes into. Typing in it replaces the list with the one
 * matching error, which is the only thing an admin answering a report needs.
 */
function ReferenceSearch({
  reference,
  onChange,
}: {
  reference: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-4">
      <label htmlFor="error-reference" className="text-content-300 text-sm font-medium">
        Reference
      </label>
      <input
        id="error-reference"
        value={reference}
        onChange={(event) => onChange(event.target.value)}
        placeholder="ERR-9F3A2C"
        spellCheck={false}
        className="border-input bg-surface-900/60 focus-visible:border-ring focus-visible:ring-ring/40 mt-1.5 w-full rounded-xl border px-3.5 py-2.5 font-mono text-sm transition-shadow outline-none focus-visible:ring-3"
      />
    </div>
  );
}

/** The result of a lookup: the error, or a plain no. */
function ReferenceResult({ reference }: { reference: string }) {
  const lookup = useErrorLookup(reference);

  if (lookup.isPending) return <p className="text-content-500 text-sm">Looking that up…</p>;

  if (lookup.isError) {
    return (
      <p className="text-content-500 text-sm">
        No error carries that reference. Check the code as the user wrote it.
      </p>
    );
  }

  return (
    <ul className="divide-border bg-surface-800 border-border divide-y rounded-2xl border">
      <ErrorRow entry={lookup.data} />
    </ul>
  );
}

/**
 * One failure, closed. The stack is behind a click: a page of them open at once is
 * unreadable, and the reference plus the route is what identifies the row.
 */
function ErrorRow({ entry }: { entry: ErrorLogEntry }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li className="px-5 py-3.5">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-baseline gap-3 text-left"
      >
        <code className="text-content-100 shrink-0 font-mono text-sm">{entry.reference}</code>
        <span
          className={cn(
            'shrink-0 text-xs tabular-nums',
            entry.statusCode >= 500 ? 'text-destructive' : 'text-idle',
          )}
        >
          {entry.statusCode}
        </span>
        <span className="text-content-300 min-w-0 flex-1 truncate text-sm">
          {entry.method} {entry.path}
        </span>
        <span className="text-content-500 shrink-0 text-xs">
          {new Date(entry.createdAt).toLocaleString()}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-2">
          <p className="text-content-200 text-sm">{entry.detail}</p>
          {entry.userId !== null && (
            <p className="text-content-500 text-xs">
              Signed in as <code className="font-mono">{entry.userId}</code>
            </p>
          )}
          {entry.stack !== null && (
            <pre className="bg-surface-900/60 text-content-400 overflow-x-auto rounded-xl p-3 text-xs">
              {entry.stack}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}
