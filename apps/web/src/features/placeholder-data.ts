/**
 * Scaffolding for the layout shell.
 *
 * Servers and members are real now (Phase 4). Channels and messages still render
 * from this static data until Phases 5 and 6 land, so the layout stays reviewable.
 * Delete this file once those queries arrive.
 */

export interface PlaceholderChannel {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE';
  category: string;
}

export interface PlaceholderMessage {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export const placeholderChannels: PlaceholderChannel[] = [
  { id: 'general', name: 'general', type: 'TEXT', category: 'Conversations' },
  { id: 'random', name: 'random', type: 'TEXT', category: 'Conversations' },
  { id: 'dev', name: 'dev', type: 'TEXT', category: 'Conversations' },
  { id: 'general-voice', name: 'Around the table', type: 'VOICE', category: 'Voice' },
];

export const placeholderMessages: PlaceholderMessage[] = [
  { id: '1', author: 'ada', content: 'morning, kettle is on ☕', timestamp: '09:02' },
  {
    id: '2',
    author: 'grace',
    content: 'did anyone actually look at the deploy last night',
    timestamp: '09:04',
  },
  {
    id: '3',
    author: 'grace',
    content: 'health check is green on my machine at least',
    timestamp: '09:04',
  },
  {
    id: '4',
    author: 'linus',
    content: 'pushed a fix for the login redirect before bed, should be fine now',
    timestamp: '09:11',
  },
];
