import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Server, ServerSummary } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { serversApi, type CreateInviteInput, type RoleInput } from './api';

/** The rail. Every server you are in, in join order. */
export function useServers() {
  return useQuery({ queryKey: keys.servers, queryFn: serversApi.list });
}

/**
 * One server with its roles and your own permissions. `serverId` is null on the
 * DM route, where there is no server to fetch.
 */
export function useServer(serverId: string | null) {
  return useQuery({
    queryKey: keys.server(serverId ?? ''),
    queryFn: () => serversApi.get(serverId ?? ''),
    enabled: serverId !== null,
  });
}

export function useMembers(serverId: string | null) {
  return useQuery({
    queryKey: keys.members(serverId ?? ''),
    queryFn: () => serversApi.members(serverId ?? ''),
    enabled: serverId !== null,
  });
}

export function useRoles(serverId: string | null) {
  return useQuery({
    queryKey: keys.roles(serverId ?? ''),
    queryFn: () => serversApi.roles(serverId ?? ''),
    enabled: serverId !== null,
  });
}

export function useInvites(serverId: string | null) {
  return useQuery({
    queryKey: keys.invites(serverId ?? ''),
    queryFn: () => serversApi.invites(serverId ?? ''),
    enabled: serverId !== null,
  });
}

/** Looks up a code before joining, so the dialog can name the server. */
export function useInvitePreview(code: string | null) {
  return useQuery({
    queryKey: keys.invitePreview(code ?? ''),
    queryFn: () => serversApi.previewInvite(code ?? ''),
    enabled: code !== null,
    // A bad code is an answer about the code, not a transient failure.
    retry: false,
  });
}

export function useCreateServer() {
  return useServerMutation((name: string) => serversApi.create(name));
}

export function useJoinServer() {
  return useServerMutation((code: string) => serversApi.joinInvite(code));
}

export function useRenameServer(serverId: string) {
  return useServerMutation((name: string) => serversApi.rename(serverId, name));
}

export function useUploadServerIcon(serverId: string) {
  return useServerMutation((file: File) => serversApi.uploadIcon(serverId, file));
}

export function useRemoveServerIcon(serverId: string) {
  return useServerMutation(() => serversApi.removeIcon(serverId));
}

/**
 * Anything that answers with a server seeds that server's cache entry and refreshes
 * the rail, which is the one list that can gain or lose an entry.
 */
function useServerMutation<TInput>(mutationFn: (input: TInput) => Promise<Server>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (server) => {
      queryClient.setQueryData<Server>(keys.server(server.id), server);
      void queryClient.invalidateQueries({ queryKey: keys.servers });
    },
  });
}

export function useDeleteServer() {
  return useRailMutation((serverId: string) => serversApi.remove(serverId));
}

export function useLeaveServer() {
  return useRailMutation((serverId: string) => serversApi.leave(serverId));
}

/** Leaving or deleting drops the server from the rail and its cache entry with it. */
function useRailMutation(mutationFn: (serverId: string) => Promise<void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (_result, serverId) => {
      queryClient.removeQueries({ queryKey: keys.server(serverId) });
      void queryClient.invalidateQueries({ queryKey: keys.servers });
    },
  });
}

export function useSetNickname(serverId: string) {
  return useMemberMutation(serverId, (input: { userId: string; nickname: string | null }) =>
    serversApi.setNickname(serverId, input.userId, input.nickname),
  );
}

export function useKickMember(serverId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ModerationInput) => serversApi.kick(serverId, input.userId, input.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.members(serverId) });
      // The kick is now an audit entry, so a log left open is out of date.
      void queryClient.invalidateQueries({ queryKey: keys.auditLog(serverId) });
    },
  });
}

/** Bans are read by moderators only, so the list is fetched where it is shown. */
export function useBans(serverId: string | null) {
  return useQuery({
    queryKey: keys.bans(serverId ?? ''),
    queryFn: () => serversApi.bans(serverId ?? ''),
    enabled: serverId !== null,
  });
}

export function useAuditLog(serverId: string | null) {
  return useQuery({
    queryKey: keys.auditLog(serverId ?? ''),
    queryFn: () => serversApi.auditLog(serverId ?? ''),
    enabled: serverId !== null,
  });
}

export function useBanMember(serverId: string) {
  return useBanMutation(serverId, (input: ModerationInput) =>
    serversApi.ban(serverId, input.userId, input.reason),
  );
}

export function useUnbanMember(serverId: string) {
  return useBanMutation(serverId, (userId: string) => serversApi.unban(serverId, userId));
}

/**
 * A ban moves three lists at once: the bans, the member list the banned user just
 * left, and the audit log that now has an entry for it.
 */
function useBanMutation<TInput, TResult>(
  serverId: string,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bans(serverId) });
      void queryClient.invalidateQueries({ queryKey: keys.members(serverId) });
      void queryClient.invalidateQueries({ queryKey: keys.auditLog(serverId) });
    },
  });
}

export function useAssignRole(serverId: string) {
  return useMemberMutation(serverId, (input: { userId: string; roleId: string }) =>
    serversApi.assignRole(serverId, input.userId, input.roleId),
  );
}

export function useUnassignRole(serverId: string) {
  return useMemberMutation(serverId, (input: { userId: string; roleId: string }) =>
    serversApi.unassignRole(serverId, input.userId, input.roleId),
  );
}

/** Who a moderation action is about, and the reason that goes in the audit log. */
export interface ModerationInput {
  userId: string;
  reason?: string;
}

/** Member changes are re-read rather than patched: role sets are the server's call. */
function useMemberMutation<TInput, TResult>(
  serverId: string,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.members(serverId) }),
  });
}

export function useCreateRole(serverId: string) {
  return useRoleMutation(serverId, (input: RoleInput & { name: string }) =>
    serversApi.createRole(serverId, input),
  );
}

export function useUpdateRole(serverId: string) {
  // `roleId` identifies the role in the URL and must not travel in the body too —
  // the API validates with `forbidNonWhitelisted`, so an extra field is a 400.
  return useRoleMutation(serverId, ({ roleId, ...changes }: { roleId: string } & RoleInput) =>
    serversApi.updateRole(serverId, roleId, changes),
  );
}

export function useDeleteRole(serverId: string) {
  return useRoleMutation(serverId, (roleId: string) => serversApi.deleteRole(serverId, roleId));
}

/**
 * A role change moves the roles list, the members that hold it, and the server's own
 * `roles` array — so all three are invalidated together.
 */
function useRoleMutation<TInput, TResult>(
  serverId: string,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.roles(serverId) });
      void queryClient.invalidateQueries({ queryKey: keys.members(serverId) });
      void queryClient.invalidateQueries({ queryKey: keys.server(serverId) });
    },
  });
}

export function useCreateInvite(serverId: string) {
  return useInviteMutation(serverId, (input: CreateInviteInput) =>
    serversApi.createInvite(serverId, input),
  );
}

export function useRevokeInvite(serverId: string) {
  return useInviteMutation(serverId, (code: string) => serversApi.revokeInvite(serverId, code));
}

function useInviteMutation<TInput, TResult>(
  serverId: string,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invites(serverId) }),
  });
}

/** The rail needs initials when a server has no icon. */
export function serverInitials(server: Pick<ServerSummary, 'name'>): string {
  const words = server.name.split(/\s+/).filter(Boolean);

  if (words.length > 1) {
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase();
  }

  return (
    server.name
      .replace(/[^\p{L}\p{N}]/gu, '')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}
