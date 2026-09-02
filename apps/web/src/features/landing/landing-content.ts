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
  { value: 'Self-hosted', label: 'One box, one database, no middlemen' },
  { value: 'Open source', label: 'Read every line before you trust it' },
  { value: 'No tracking', label: 'Nobody is reading over your shoulder' },
];

/**
 * A short, warm conversation for the hero preview. Not real data — it is there
 * so a first-time visitor can see what the room looks like with people in it.
 */
export interface HeroPreviewLine {
  author: string;
  initials: string;
  time: string;
  text: string;
}

export const heroPreview: HeroPreviewLine[] = [
  {
    author: 'Linus',
    initials: 'li',
    time: '19:04',
    text: "Yo, what's this?",
  },
  {
    author: 'Adam',
    initials: 'ad',
    time: '19:05',
    text: "It's a chat app! You can send messages, create channels, and more.",
  },
  {
    author: 'Linus',
    initials: 'li',
    time: '19:06',
    text: 'Really? It looks just like Discord.',
  },
];
