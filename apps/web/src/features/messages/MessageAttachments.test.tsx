import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { MessageAttachment } from '@nestcord/shared';

import { MessageAttachments } from './MessageAttachments';

function image(name: string): MessageAttachment {
  return {
    id: `attachment-${name}`,
    filename: name,
    mimeType: 'image/png',
    size: 2048,
    url: `/uploads/attachments/${name}`,
  };
}

const PDF: MessageAttachment = {
  id: 'attachment-pdf',
  filename: 'invoice.pdf',
  mimeType: 'application/pdf',
  size: 90_000,
  url: '/uploads/attachments/invoice.pdf',
};

function openGallery(name: string) {
  return userEvent.click(screen.getByRole('button', { name: `Open ${name}` }));
}

describe('MessageAttachments', () => {
  it('opens an image over the app instead of navigating away', async () => {
    render(<MessageAttachments attachments={[image('one.png')]} />);

    await openGallery('one.png');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'one.png' })).toBeInTheDocument();
  });

  it('opens the image that was clicked, not the first one', async () => {
    render(<MessageAttachments attachments={[image('one.png'), image('two.png')]} />);

    await openGallery('two.png');

    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('browses to the next image', async () => {
    render(<MessageAttachments attachments={[image('one.png'), image('two.png')]} />);

    await openGallery('one.png');
    await userEvent.click(screen.getByRole('button', { name: 'Next image' }));

    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('wraps around rather than dead-ending', async () => {
    render(<MessageAttachments attachments={[image('one.png'), image('two.png')]} />);

    await openGallery('one.png');
    await userEvent.click(screen.getByRole('button', { name: 'Previous image' }));

    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('browses with the arrow keys too', async () => {
    render(<MessageAttachments attachments={[image('one.png'), image('two.png')]} />);

    await openGallery('one.png');
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('offers no browsing for a single image', async () => {
    render(<MessageAttachments attachments={[image('one.png')]} />);

    await openGallery('one.png');

    expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();
    expect(screen.queryByText(/1 of 1/)).toBeNull();
  });

  it('closes on Escape', async () => {
    render(<MessageAttachments attachments={[image('one.png')]} />);

    await openGallery('one.png');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('still offers the original in a new tab', async () => {
    render(<MessageAttachments attachments={[image('one.png')]} />);

    await openGallery('one.png');

    expect(screen.getByRole('link', { name: /open original/i })).toHaveAttribute(
      'href',
      '/uploads/attachments/one.png',
    );
  });

  it('leaves a file that is not an image as a download link', () => {
    render(<MessageAttachments attachments={[PDF]} />);

    expect(screen.getByRole('link', { name: /invoice\.pdf/ })).toHaveAttribute('href', PDF.url);
    expect(screen.queryByRole('button', { name: 'Open invoice.pdf' })).toBeNull();
  });

  it('counts only the images when a message mixes them with a file', async () => {
    render(<MessageAttachments attachments={[PDF, image('one.png'), image('two.png')]} />);

    await openGallery('one.png');

    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });
});
