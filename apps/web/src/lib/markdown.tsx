import type { ReactNode } from 'react';

import { parseMentions, type Mention } from '@nestcord/shared';

import { Spoiler } from './Spoiler';

/**
 * The small markdown dialect chat actually uses (PLAN.MD §8): bold, italic,
 * strikethrough, inline code, code blocks, blockquotes and spoilers.
 *
 * This is a deliberate hand-rolled parser rather than a markdown library. The
 * supported set is closed and tiny, links are not in it, and a general parser would
 * bring HTML passthrough — which is the one thing a chat renderer must not have.
 * Content is always rendered as React elements, never as `dangerouslySetInnerHTML`,
 * so a message containing markup is text and cannot become markup.
 */

export interface MarkdownOptions {
  /**
   * Renders a mention. Defaults to plain text, so the parser stays unaware of who
   * exists — resolving a name against real members is the caller's job.
   */
  renderMention?: (mention: Mention, key: string) => ReactNode;
}

const CODE_BLOCK = /```(\w*)\n?([\s\S]*?)```/g;

/**
 * One pass over the inline syntax. Order matters: inline code comes first because
 * nothing inside backticks is markup, and the two-character markers come before the
 * one-character ones so `**bold**` is not read as two empty italics.
 *
 * The two mention tokens have to accept exactly what `parseMentions` accepts, or a
 * token this pass cuts short never reaches it — `#hälsa` would arrive as `#h`.
 */
const INLINE =
  /`([^`\n]+)`|\|\|([\s\S]+?)\|\||\*\*([\s\S]+?)\*\*|~~([\s\S]+?)~~|\*([^*\n]+)\*|_([^_\n]+)_|@[a-zA-Z0-9._]+|#[\p{L}\p{N}-]+/gu;

/** Renders message content as elements. */
export function renderMarkdown(content: string, options: MarkdownOptions = {}): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of content.matchAll(CODE_BLOCK)) {
    if (match.index > cursor) {
      nodes.push(...renderBlocks(content.slice(cursor, match.index), options, `t${cursor}`));
    }

    nodes.push(
      <pre
        key={`code-${match.index}`}
        className="bg-surface-800 border-border my-1 overflow-x-auto rounded-lg border p-3 text-sm"
      >
        <code>{match[2] ?? ''}</code>
      </pre>,
    );

    cursor = match.index + match[0].length;
  }

  nodes.push(...renderBlocks(content.slice(cursor), options, `t${cursor}`));

  return nodes;
}

/** Splits text into blockquotes and ordinary lines, keeping the line breaks. */
function renderBlocks(text: string, options: MarkdownOptions, keyPrefix: string): ReactNode[] {
  if (!text) return [];

  const nodes: ReactNode[] = [];
  let quoted: string[] = [];

  const flushQuote = (index: number) => {
    if (quoted.length === 0) return;

    nodes.push(
      <blockquote
        key={`${keyPrefix}-quote-${index}`}
        className="border-border text-content-200 my-1 border-l-2 pl-3"
      >
        {renderInline(quoted.join('\n'), options, `${keyPrefix}-q${index}`)}
      </blockquote>,
    );

    quoted = [];
  };

  const lines = text.split('\n');

  lines.forEach((line, index) => {
    const quote = /^>\s?(.*)$/.exec(line);

    if (quote) {
      quoted.push(quote[1] ?? '');
      return;
    }

    flushQuote(index);

    // Blank lines between paragraphs are kept as a break rather than collapsed,
    // because in chat the author put them there on purpose.
    nodes.push(
      <span key={`${keyPrefix}-line-${index}`}>
        {renderInline(line, options, `${keyPrefix}-l${index}`)}
        {index < lines.length - 1 && <br />}
      </span>,
    );
  });

  flushQuote(lines.length);

  return nodes;
}

function renderInline(text: string, options: MarkdownOptions, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE)) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));

    const key = `${keyPrefix}-${match.index}`;
    const [token, code, spoiler, bold, strike, star, underscore] = match;

    if (code !== undefined) {
      nodes.push(
        <code key={key} className="bg-surface-800 rounded px-1.5 py-0.5 text-[0.9em]">
          {code}
        </code>,
      );
    } else if (spoiler !== undefined) {
      nodes.push(<Spoiler key={key}>{renderInline(spoiler, options, `${key}-s`)}</Spoiler>);
    } else if (bold !== undefined) {
      nodes.push(<strong key={key}>{renderInline(bold, options, `${key}-b`)}</strong>);
    } else if (strike !== undefined) {
      nodes.push(<s key={key}>{renderInline(strike, options, `${key}-k`)}</s>);
    } else if (star !== undefined || underscore !== undefined) {
      const italic = star ?? underscore ?? '';
      nodes.push(<em key={key}>{renderInline(italic, options, `${key}-i`)}</em>);
    } else {
      nodes.push(renderMentionToken(token, options, key));
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));

  return nodes;
}

/** Mentions are parsed by the shared rules, so the API and the UI agree on them. */
function renderMentionToken(token: string, options: MarkdownOptions, key: string): ReactNode {
  const mention = parseMentions(token)[0];

  if (!mention) return token;
  if (!options.renderMention) return token;

  return options.renderMention(mention, key);
}
