import {
  Hash,
  Lock,
  MessagesSquare,
  Radio,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** Copy and data for the landing page, kept out of the components. */

export interface LandingFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const features: LandingFeature[] = [
  {
    icon: MessagesSquare,
    title: 'Messages that feel instant',
    description:
      'Send, edit, reply and react. Markdown, mentions and code blocks render the way you expect them to.',
  },
  {
    icon: Radio,
    title: 'Realtime by default',
    description:
      'Socket.IO keeps every open tab in sync — new messages, typing indicators and presence, with no refresh.',
  },
  {
    icon: Hash,
    title: 'Servers and channels',
    description:
      'Organise conversations into categories, text channels and voice channels, exactly where you expect them.',
  },
  {
    icon: ShieldCheck,
    title: 'Permissions that hold',
    description:
      'Roles, hierarchy and per-channel overrides, resolved on the server. The frontend never decides who may do what.',
  },
  {
    icon: Users,
    title: 'Friends and direct messages',
    description:
      'Send requests, block who you need to, and talk one to one or in a group without leaving the app.',
  },
  {
    icon: Lock,
    title: 'Sensible security',
    description:
      'Argon2 password hashing, rotating refresh tokens stored hashed, validated input and rate limits on what matters.',
  },
];

export const stack = [
  'NestJS',
  'React',
  'TypeScript',
  'Prisma',
  'PostgreSQL',
  'Socket.IO',
  'Tailwind',
];

export const stats = [
  { value: 'Self-hosted', label: 'Runs on one box, one database' },
  { value: 'Open source', label: 'Read every line before you trust it' },
  { value: 'No tracking', label: 'Your conversations stay yours' },
];
