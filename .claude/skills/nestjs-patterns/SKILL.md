---
name: nestjs-patterns
description: Concrete NestJS + Prisma patterns for the NestCord API — module shape, DTOs, services, guards, pagination, error handling. Use when adding or changing anything under apps/api.
---

# NestJS Patterns (NestCord API)

## When to activate

Adding a module, endpoint, DTO, guard, or service; changing how the API talks to Prisma; deciding
where API logic belongs.

## Module shape

```text
apps/api/src/messages/
  messages.module.ts
  messages.controller.ts
  messages.service.ts
  dto/create-message.dto.ts
  dto/update-message.dto.ts
  messages.service.spec.ts
```

```ts
@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService], // only what other modules genuinely need
})
export class MessagesModule {}
```

## Controller: transport only

```ts
@Controller('channels/:channelId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @RequirePermission(Permission.VIEW_CHANNEL)
  list(
    @Param('channelId') channelId: string,
    @Query() query: ListMessagesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messages.list(channelId, user.id, query);
  }

  @Post()
  @RequirePermission(Permission.SEND_MESSAGES)
  create(
    @Param('channelId') channelId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messages.create(channelId, user.id, dto);
  }
}
```

No business logic, no Prisma calls, no permission math in a controller.

## DTOs

```ts
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

export class ListMessagesDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
```

Global pipe:

```ts
app.useGlobalPipes(
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
);
```

## Service: logic + Prisma, nothing between

```ts
@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(channelId: string, userId: string, { cursor, limit }: ListMessagesDto) {
    return this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        reactions: true,
        replyTo: { select: { id: true, content: true, authorId: true } },
      },
    });
  }

  async update(messageId: string, userId: string, dto: UpdateMessageDto) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    return this.prisma.message.update({
      where: { id: messageId },
      data: { content: dto.content, editedAt: new Date() },
    });
  }
}
```

Note the `select` on `author` — never spread a whole `User` into a response.

## Guards and decorators

- `JwtAuthGuard` registered globally; public routes opt out with `@Public()`.
- `PermissionGuard` reads `@RequirePermission(...)` metadata, resolves the member's effective
  permissions for the channel/server in the route params, and throws `ForbiddenException`.
- `@CurrentUser()` param decorator pulls the authenticated user off the request.

Permission resolution lives in exactly one place and is shared with the gateway.

## Pagination

Cursor-based, newest first, capped page size. Return the items plus the next cursor. Never expose an
endpoint that can return a channel's whole history.

## Errors

Use Nest's HTTP exceptions. A global exception filter logs the detail server-side and returns a safe
shape:

```json
{ "statusCode": 403, "message": "You do not have permission to send messages here" }
```

Never include stack traces, Prisma error text, or internal ids the caller should not know about.

## Swagger

Decorate DTOs and controllers so `/api/docs` reflects reality. It is the frontend's contract.

## Anti-patterns for this project

- A repository or facade between service and Prisma
- A generic `BaseService<T>` with CRUD generics
- Business logic in a controller or a guard
- Prisma calls inside a loop
- A DI token/interface with exactly one implementation
