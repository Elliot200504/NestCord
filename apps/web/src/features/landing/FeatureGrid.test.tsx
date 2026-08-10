import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeatureGrid } from './FeatureGrid';
import { features } from './landing-content';

describe('FeatureGrid', () => {
  it('renders a card for every feature', () => {
    render(<FeatureGrid />);

    expect(screen.getAllByRole('listitem')).toHaveLength(features.length);
    for (const feature of features) {
      expect(screen.getByText(feature.title)).toBeInTheDocument();
    }
  });

  it('exposes the section through its heading', () => {
    render(<FeatureGrid />);

    expect(
      screen.getByRole('heading', { name: 'Everything a small community needs', level: 2 }),
    ).toBeInTheDocument();
  });
});
