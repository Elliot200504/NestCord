import { Menu, Users } from 'lucide-react';

import { useMediaQuery, SHELL_ROOMY, SHELL_WIDE } from '@/hooks/useMediaQuery';
import { useUiStore } from '@/stores/ui-store';

/**
 * Opens the channel list on a narrow viewport. Absent on a wide one, where the list
 * is already a column and the button would do nothing.
 */
export function OpenChannelsButton() {
  const wide = useMediaQuery(SHELL_WIDE);
  const openDrawer = useUiStore((state) => state.openDrawer);

  if (wide) return null;

  return (
    <button
      type="button"
      onClick={() => openDrawer('channels')}
      aria-label="Open the channel list"
      className="text-content-300 hover:text-content-100 -ml-1 transition-colors"
    >
      <Menu className="size-5" aria-hidden />
    </button>
  );
}

/**
 * Shows and hides the member list.
 *
 * Which state it drives depends on the width: a column that can be collapsed when
 * there is room for one, an overlay when there is not.
 */
export function MemberListButton() {
  const roomy = useMediaQuery(SHELL_ROOMY);
  const toggleMemberList = useUiStore((state) => state.toggleMemberList);
  const openDrawer = useUiStore((state) => state.openDrawer);
  const memberListOpen = useUiStore((state) => state.memberListOpen);

  return (
    <button
      type="button"
      onClick={() => (roomy ? toggleMemberList() : openDrawer('members'))}
      aria-label={roomy && memberListOpen ? 'Hide the member list' : 'Show the member list'}
      aria-pressed={roomy ? memberListOpen : undefined}
      className="text-content-300 hover:text-content-100 transition-colors"
    >
      <Users className="size-5" aria-hidden />
    </button>
  );
}
