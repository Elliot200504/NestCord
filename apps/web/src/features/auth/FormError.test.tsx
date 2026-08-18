import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GENERIC_ERROR_MESSAGE } from '@nestcord/shared';

import { ApiError } from '@/api/client';
import { FormError } from './FormError';

describe('FormError', () => {
  it('shows nothing when nothing failed', () => {
    const { container } = render(<FormError error={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the message a 4xx wrote for the user', () => {
    render(<FormError error={new ApiError(409, 'That username is taken')} />);

    expect(screen.getByRole('alert')).toHaveTextContent('That username is taken');
  });

  it('shows the reference so a user can report the failure', () => {
    render(<FormError error={new ApiError(500, GENERIC_ERROR_MESSAGE, 'ERR-9F3A2C')} />);

    expect(screen.getByRole('alert')).toHaveTextContent('ERR-9F3A2C');
  });

  it('mentions no reference when the error explained itself', () => {
    render(<FormError error={new ApiError(403, 'You cannot post here')} />);

    expect(screen.getByRole('alert')).not.toHaveTextContent('Reference');
  });

  it('falls back to the generic line for a failure that never reached the API', () => {
    render(<FormError error={new TypeError('fetch failed')} />);

    const alert = screen.getByRole('alert');

    expect(alert).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    // A browser-level message is a developer's clue, not a user's.
    expect(alert).not.toHaveTextContent('fetch failed');
  });
});
