import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeatureGrid } from './FeatureGrid';

describe('FeatureGrid', () => {
  it('exposes the section through its heading', () => {
    render(<FeatureGrid />);

    expect(
      screen.getByRole('heading', { name: 'Everything a small community needs', level: 2 }),
    ).toBeInTheDocument();
  });
});
