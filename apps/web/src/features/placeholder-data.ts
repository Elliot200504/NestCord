/**
 * Scaffolding for the layout shell.
 *
 * Servers, members and channels are real now (Phases 4 and 5). Messages still render
 * from this static data until Phase 6 lands, so the layout stays reviewable. Delete
 * this file once that query arrives.
 */

export interface PlaceholderMessage {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

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
