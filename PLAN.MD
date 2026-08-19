# Discord Clone — Small-Scale Toy Project

You are a senior full-stack developer helping me build a **small-scale Discord-inspired chat application as a learning/toy project**.

The application is intentionally designed to support **only a few hundred users**, not thousands or millions.

The goal is to build a complete, enjoyable Discord clone with good architecture and modern technologies, while **avoiding unnecessary enterprise-level complexity**.

Do not over-engineer the application.

Prioritize:

1. Simplicity
2. Readable code
3. Good architecture
4. Learning value
5. Feature completeness
6. Reasonable performance for a few hundred users

Do NOT design the application for massive scale.

---

# 1. Technology Stack

## Monorepo

Use:

* pnpm
* pnpm workspaces
* TypeScript
* ESLint
* Prettier

Use a simple workspace structure:

```text
discord-clone/
├── apps/
│   ├── api/
│   └── web/
│
├── packages/
│   ├── database/
│   └── shared/
│
├── package.json
├── pnpm-workspace.yaml
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

Do **not** add Turborepo unless there is a clear benefit.

The project is intentionally small.

---

# 2. Backend

Use:

* NestJS
* TypeScript
* Prisma
* PostgreSQL
* Socket.IO
* JWT
* Argon2
* class-validator
* Swagger

Use a straightforward NestJS architecture.

Recommended modules:

```text
apps/api/src/
├── auth/
├── users/
├── servers/
├── channels/
├── messages/
├── roles/
├── friends/
├── dms/
├── attachments/
├── notifications/
├── gateway/
├── common/
└── main.ts
```

Do not create unnecessary abstractions.

Avoid building repository/service/factory layers everywhere unless they actually improve the code.

NestJS services can directly use Prisma.

---

# 3. Database

Use PostgreSQL with Prisma.

Create a clean schema for:

### User

```text
User
- id
- username
- email
- passwordHash
- avatarUrl
- status
- createdAt
- updatedAt
```

### Session

Support refresh tokens and multiple sessions.

```text
Session
- id
- userId
- refreshTokenHash
- createdAt
- expiresAt
```

### Server

```text
Server
- id
- name
- iconUrl
- ownerId
- createdAt
```

### ServerMember

```text
ServerMember
- id
- serverId
- userId
- nickname
- joinedAt
```

### Role

```text
Role
- id
- serverId
- name
- color
- permissions
- position
```

### Channel

Support:

* text
* voice
* category

```text
Channel
- id
- serverId
- name
- type
- topic
- position
- parentId
- createdAt
```

### Message

```text
Message
- id
- channelId
- authorId
- content
- replyToId
- editedAt
- createdAt
```

### Reaction

```text
Reaction
- id
- messageId
- userId
- emoji
```

### Friendship

Support:

* pending
* accepted
* blocked

### DirectMessage / Conversation

Support:

* one-to-one DMs
* group DMs

### Attachment

Store metadata in PostgreSQL.

For this toy project, local filesystem storage is acceptable.

Do not build an elaborate object-storage abstraction unless it is genuinely useful.

---

# 4. Authentication

Implement:

* registration
* login
* logout
* refresh token
* protected routes
* password hashing
* session management

Use:

**Argon2**

Never store plaintext passwords.

Use:

```text
short-lived access token
+
long-lived refresh token
```

Refresh tokens should be stored hashed in the database.

Email verification and password recovery can be left as future features unless needed for the core application.

---

# 5. Authorization

Implement a simple Discord-style permission system.

Permissions should include:

```text
VIEW_CHANNEL
SEND_MESSAGES
MANAGE_MESSAGES
ATTACH_FILES
ADD_REACTIONS
CONNECT
SPEAK
MANAGE_CHANNELS
MANAGE_SERVER
MANAGE_ROLES
KICK_MEMBERS
BAN_MEMBERS
ADMINISTRATOR
```

Implement:

* @everyone role
* custom roles
* role hierarchy
* basic channel permission overrides
* administrator bypass

Keep the permission system understandable.

Do not build an excessively complicated permission engine.

---

# 6. Realtime

Use:

**NestJS WebSockets + Socket.IO**

Realtime functionality should include:

```text
message:create
message:update
message:delete

typing:start
typing:stop

reaction:add
reaction:remove

presence:update

member:join
member:leave

notification:create
```

For this project:

**Do NOT use Redis.**

A single NestJS instance is completely acceptable.

Socket.IO rooms can be used for:

* servers
* channels
* DM conversations

Example:

```text
server:{serverId}
channel:{channelId}
dm:{conversationId}
```

---

# 7. Presence

Implement simple in-memory presence.

Support:

```text
ONLINE
IDLE
DO_NOT_DISTURB
OFFLINE
```

Presence does not need to survive server restarts.

That is completely acceptable for this project.

---

# 8. Messaging

Build a proper Discord-like messaging experience.

Support:

### Messages

* send
* edit
* delete
* reply
* reactions

### Markdown

Support:

* bold
* italic
* strikethrough
* inline code
* code blocks
* blockquotes
* spoilers

### Mentions

Support:

```text
@username
@everyone
#channel
```

### Message pagination

Use cursor-based or simple timestamp-based pagination.

Do not load an entire channel's message history at once.

---

# 9. Attachments

Support image/file uploads.

For this small project:

```text
apps/api/uploads/
```

is acceptable.

Store files locally.

Store metadata in PostgreSQL.

Support:

* filename
* MIME type
* size
* URL

Limit upload sizes.

Validate MIME types.

Generate safe filenames.

---

# 10. Frontend

Use the newest stable versions available when starting the project:

* React
* Vite
* TypeScript
* TanStack Router
* TanStack Query
* Zustand
* Tailwind CSS
* Radix UI
* Lucide React

Use a clean feature-based structure:

```text
apps/web/src/
├── routes/
├── components/
├── features/
│   ├── auth/
│   ├── servers/
│   ├── channels/
│   ├── messages/
│   ├── friends/
│   ├── dms/
│   └── settings/
│
├── api/
├── hooks/
├── stores/
├── websocket/
├── lib/
└── main.tsx
```

---

# 11. TanStack Router

Use TanStack Router.

Routes:

```text
/login
/register

/app
/app/@me
/app/@me/friends
/app/@me/dm/:conversationId

/app/:serverId
/app/:serverId/:channelId

/settings
/settings/account
/settings/profile
/settings/appearance
```

Authenticated routes should be protected.

---

# 12. TanStack Query

Use TanStack Query for server state.

Examples:

```text
useCurrentUser()
useServers()
useServer()
useChannels()
useMessages()
useMembers()
useFriends()
useConversations()
```

Use mutations for:

* creating servers
* creating channels
* sending messages
* editing messages
* deleting messages
* reactions
* friend requests

Realtime Socket.IO events should update or invalidate relevant queries.

Do not put API data into Zustand.

---

# 13. Zustand

Use Zustand only for client-side UI state.

Examples:

```text
selectedServer
selectedChannel
sidebarOpen
memberListOpen
activeModal
theme
```

Do not use Zustand as a replacement for TanStack Query.

---

# 14. UI

Create a polished Discord-inspired interface.

Desktop layout:

```text
┌──────┬──────────────┬──────────────────────────┬─────────────┐
│      │              │                          │             │
│      │   Channels   │        Messages          │   Members   │
│      │              │                          │             │
│      │              │                          │             │
│      │              │                          │             │
│Servers│             │                          │             │
│      │              │                          │             │
│      │              │                          │             │
├──────┼──────────────┼──────────────────────────┼─────────────┤
│      │ User panel   │ Message composer         │             │
└──────┴──────────────┴──────────────────────────┴─────────────┘
```

Implement:

* server sidebar
* channel sidebar
* channel header
* message list
* message composer
* member list
* user panel
* context menus
* modals
* unread indicators
* typing indicator
* online indicators

Make the UI responsive.

---

# 15. Message Components

Create reusable components:

```text
MessageList
Message
MessageGroup
MessageContent
MessageAuthor
MessageTimestamp
MessageActions
MessageReaction
MessageAttachment
MessageReply
MessageComposer
TypingIndicator
```

Group messages from the same user when appropriate.

Provide message actions:

* reply
* edit
* delete
* react
* copy

---

# 16. Servers

Users should be able to:

* create servers
* leave servers
* delete servers if owner
* invite users
* join servers
* change server name/icon

Server owners should be able to:

* manage channels
* manage roles
* manage members
* kick users
* ban users

---

# 17. Channels

Support:

### Categories

Users can create categories.

### Text channels

Support:

* name
* topic
* position
* category
* permissions

### Voice channels

People join a voice channel and talk to each other.

Transmission is a peer-to-peer **WebRTC mesh**: the API relays signalling and tracks who is in which
call, and the audio goes browser to browser. STUN only, no TURN.

A mesh means every participant uploads their microphone once per other participant, so a channel is
capped at **8 people**, enforced by the gateway.

Do not introduce a complicated SFU architecture. The cost of that choice is that `SPEAK` cannot be
truly enforced — the server never sees the media — which is accepted.

---

# 18. Friends

Create a friends page.

Support:

```text
Online
All
Pending
Blocked
Add Friend
```

Users can:

* send friend requests
* accept
* reject
* remove friends
* block users

---

# 19. Direct Messages

Support:

* one-to-one DMs
* group DMs

Users can:

* create DM
* send messages
* edit messages
* delete messages
* react to messages

Use the same message system where practical.

---

# 20. Notifications

Implement basic realtime notifications for:

* mentions
* friend requests
* DMs
* server invites

Keep notification persistence simple.

---

# 21. Moderation

Implement:

* kick
* ban
* unban
* delete messages

Create a basic audit log.

Example events:

```text
MEMBER_KICK
MEMBER_BAN
MEMBER_UNBAN
MESSAGE_DELETE
CHANNEL_CREATE
CHANNEL_DELETE
ROLE_CREATE
ROLE_DELETE
```

---

# 22. Search

Implement basic message search.

PostgreSQL search is sufficient.

Support:

* content
* author
* channel

Do not introduce Elasticsearch or OpenSearch.

---

# 23. Rate Limiting

Implement basic NestJS rate limiting.

Protect:

* login
* registration
* message creation
* friend requests
* file uploads

For a few hundred users, an in-memory rate limiter is acceptable.

Do not introduce Redis just for rate limiting.

---

# 24. Security

Implement reasonable security:

* DTO validation
* authorization guards
* password hashing
* CORS
* secure cookies where appropriate
* rate limiting
* file validation
* safe error messages

Do not expose:

* password hashes
* refresh tokens
* internal stack traces

Do not trust permissions from the frontend.

---

# 25. Database Performance

The application only needs to support a few hundred users.

Still create sensible indexes on:

```text
User.username
User.email

ServerMember.serverId
ServerMember.userId

Message.channelId
Message.createdAt
Message.authorId

Reaction.messageId

Friendship.userId
Friendship.friendId
```

Use pagination for messages.

Do not prematurely optimize.

---

# 26. Docker

Use Docker Compose for:

```text
PostgreSQL
```

That's it.

The frontend and NestJS backend can run directly with pnpm during development.

Example:

```bash
docker compose up -d

pnpm install

pnpm db:migrate

pnpm db:seed

pnpm dev
```

---

# 27. Testing

Add useful tests, but do not aim for enormous coverage.

Prioritize testing:

### Backend

* authentication
* permissions
* message creation
* message editing
* message deletion
* server membership
* friend requests

### Frontend

* login
* server navigation
* message composer
* message rendering

Use:

* Vitest
* Playwright
* Supertest where appropriate

---

# 28. Developer Experience

Root commands:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test

pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:reset
```

`pnpm dev` should start:

```text
NestJS API
React/Vite frontend
```

PostgreSQL should be started separately with Docker Compose.

---

# 29. Prisma

Use Prisma migrations.

Keep the schema easy to understand.

Provide a seed script that creates the development account, and nothing else.

No sample servers, channels, messages or extra users: those are created through the app while
developing, which exercises the real code paths instead of hand-written rows.

The seed must never delete anything, so it is safe to run against a database that already holds
development data. Wiping is `pnpm db:reset`, which is a separate and explicit act.

---

# 30. Project Architecture

Keep the architecture intentionally simple:

```text
React
  │
  ├── REST ──────────────► NestJS
  │                         │
  │                         ▼
  │                      Prisma
  │                         │
  │                         ▼
  │                     PostgreSQL
  │
  └── Socket.IO ─────────► NestJS
```

Do NOT introduce:

* microservices
* Redis
* Kafka
* RabbitMQ
* Elasticsearch
* Kubernetes
* distributed workers
* multiple API instances
* complicated caching
* event sourcing
* CQRS unless genuinely necessary
* dedicated SFU infrastructure

This is a small application.

---

# 31. Code Quality

Use TypeScript strict mode.

Avoid unnecessary abstractions.

Prefer straightforward code that a junior/intermediate developer can understand.

Bad:

```text
Controller
    ↓
Facade
    ↓
Service
    ↓
Repository
    ↓
Data Access Factory
    ↓
Provider
    ↓
Prisma
```

Prefer:

```text
Controller
    ↓
Service
    ↓
Prisma
```

when that is sufficient.

Keep business logic inside NestJS services.

Keep React components focused on UI.

---

# 32. Documentation

Create a concise README containing:

* project overview
* technology stack
* requirements
* installation
* environment variables
* database setup
* development commands
* architecture
* testing

Do not create dozens of documentation files.

---

# 33. Environment

Create:

```text
.env.example
```

with:

```text
DATABASE_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

API_URL=
WEB_URL=

UPLOAD_DIR=
```

Do not hardcode secrets.

---

# 34. Implementation Strategy

Build this incrementally.

## Phase 1

Project foundation:

* pnpm workspace
* NestJS
* React/Vite
* Prisma
* PostgreSQL
* Docker Compose
* shared package
* ESLint
* Prettier
* environment configuration

## Phase 2

Authentication:

* registration
* login
* JWT
* refresh tokens
* sessions
* protected routes

## Phase 3

Users:

* profiles
* avatars
* presence
* settings

## Phase 4

Servers:

* create server
* join server
* leave server
* members
* invites
* roles

## Phase 5

Channels:

* categories
* text channels
* channel permissions

## Phase 6

Messaging:

* messages
* pagination
* editing
* deletion
* replies
* reactions
* mentions
* attachments

## Phase 7

Realtime:

* Socket.IO
* realtime messages
* typing indicators
* presence
* reactions
* notifications

## Phase 8

Friends & DMs:

* friend requests
* blocking
* DMs
* group DMs

## Phase 9

Moderation:

* kick
* ban
* audit logs

## Phase 10

Polish:

* responsive UI
* loading states
* error states
* animations
* accessibility
* testing
* bug fixing

---

# 35. Development Rules

Before implementing anything:

1. Inspect the existing project.
2. Understand the current architecture.
3. Reuse existing code where appropriate.
4. Do not create duplicate systems.
5. Keep features isolated.
6. Update Prisma migrations when changing the database.
7. Test important functionality.
8. Keep TypeScript strict.
9. Keep the implementation simple.

Do not rewrite working code unnecessarily.

---

# 36. Definition of Done

A feature is complete when:

* database changes are implemented
* API functionality works
* authorization works
* frontend UI exists
* loading states exist
* error handling exists
* realtime behavior works where required
* tests cover important behavior
* TypeScript compiles
* linting passes
* the feature works end-to-end

---

# 37. First Task

Do NOT immediately start implementing every feature.

First:

1. Create the monorepo.
2. Set up pnpm workspaces.
3. Set up NestJS.
4. Set up React + Vite.
5. Set up TanStack Router.
6. Set up TanStack Query.
7. Set up Prisma.
8. Set up PostgreSQL.
9. Create Docker Compose.
10. Create the initial database schema.
11. Create the basic application layout.
12. Configure ESLint and Prettier.
13. Create the README.

Then verify:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
```

Only after the foundation works should implementation continue into authentication.

---

# Final Philosophy

This is a **toy/learning project for a few hundred users**.

Do not optimize for hypothetical millions of users.

A single NestJS server, PostgreSQL database, local file storage, and Socket.IO server are perfectly acceptable.

Favor:

**simple > clever**

**readable > abstract**

**working > over-engineered**

**feature-complete > enterprise-scale**

The goal is to learn and build a genuinely functional Discord-like application with a modern full-stack TypeScript architecture.
