import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Mention } from '@nestcord/shared';

import { renderMarkdown } from './markdown';

function draw(content: string) {
  const renderMention = (mention: Mention, key: string) => (
    <mark key={key} data-kind={mention.type}>
      {mention.name || 'everyone'}
    </mark>
  );

  return render(<div data-testid="content">{renderMarkdown(content, { renderMention })}</div>);
}

describe('renderMarkdown', () => {
  it('renders bold', () => {
    const { container } = draw('a **strong** word');

    expect(container.querySelector('strong')?.textContent).toBe('strong');
  });

  it('renders italic with either marker', () => {
    const { container } = draw('*one* and _two_');

    expect([...container.querySelectorAll('em')].map((node) => node.textContent)).toEqual([
      'one',
      'two',
    ]);
  });

  it('renders strikethrough', () => {
    const { container } = draw('~~gone~~');

    expect(container.querySelector('s')?.textContent).toBe('gone');
  });

  it('renders inline code', () => {
    const { container } = draw('run `pnpm dev` first');

    expect(container.querySelector('code')?.textContent).toBe('pnpm dev');
  });

  it('renders a fenced code block', () => {
    const { container } = draw('```ts\nconst a = 1;\n```');

    expect(container.querySelector('pre code')?.textContent).toBe('const a = 1;\n');
  });

  it('treats markup inside inline code as text', () => {
    const { container } = draw('`**not bold**`');

    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('code')?.textContent).toBe('**not bold**');
  });

  it('renders a blockquote', () => {
    const { container } = draw('> quoted\n> still quoted');

    expect(container.querySelector('blockquote')?.textContent).toBe('quoted\nstill quoted');
  });

  it('hides a spoiler until it is clicked', async () => {
    draw('||the butler did it||');

    const spoiler = screen.getByRole('button', { name: 'Reveal spoiler' });
    expect(spoiler.textContent).toBe('the butler did it');

    await userEvent.click(spoiler);

    expect(screen.queryByRole('button', { name: 'Reveal spoiler' })).toBeNull();
    expect(screen.getByTestId('content').textContent).toContain('the butler did it');
  });

  it('nests markup inside markup', () => {
    const { container } = draw('**bold with *italic* inside**');

    expect(container.querySelector('strong em')?.textContent).toBe('italic');
  });

  it('renders HTML in a message as text, never as markup', () => {
    const { container } = draw('<img src=x onerror="alert(1)">');

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror="alert(1)">');
  });

  it('hands each kind of mention to the caller', () => {
    const { container } = draw('@alice @everyone #general');

    expect([...container.querySelectorAll('mark')].map((node) => node.dataset.kind)).toEqual([
      'user',
      'everyone',
      'channel',
    ]);
  });

  it('keeps the author’s line breaks', () => {
    const { container } = draw('first\nsecond');

    expect(container.querySelectorAll('br')).toHaveLength(1);
  });
});
