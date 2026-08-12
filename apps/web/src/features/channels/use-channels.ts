import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Channel } from '@nestcord/shared';

import { keys } from '@/api/keys';
import {
  channelsApi,
  type CreateChannelInput,
  type OverrideInput,
  type UpdateChannelInput,
} from './api';

/**
 * Every channel you can see in a server, in sidebar order.
 *
 * `serverId` is null on the DM route, where there is no server to fetch.
 */
export function useChannels(serverId: string | null) {
  return useQuery({
    queryKey: keys.channels(serverId ?? ''),
    queryFn: () => channelsApi.list(serverId ?? ''),
    enabled: serverId !== null,
  });
}

/** One channel out of the list, so the header does not need its own request. */
export function useChannel(serverId: string | null, channelId: string | undefined) {
  const { data, ...rest } = useChannels(serverId);

  return { ...rest, data: data?.find((channel) => channel.id === channelId) ?? null };
}

export function useChannelOverrides(serverId: string, channelId: string | null) {
  return useQuery({
    queryKey: keys.channelOverrides(serverId, channelId ?? ''),
    queryFn: () => channelsApi.overrides(serverId, channelId ?? ''),
    enabled: channelId !== null,
  });
}

export function useCreateChannel(serverId: string) {
  return useChannelMutation(serverId, (input: CreateChannelInput) =>
    channelsApi.create(serverId, input),
  );
}

export function useUpdateChannel(serverId: string) {
  // `channelId` identifies the channel in the URL and must not travel in the body
  // too — the API validates with `forbidNonWhitelisted`, so an extra field is a 400.
  return useChannelMutation(
    serverId,
    ({ channelId, ...changes }: { channelId: string } & UpdateChannelInput) =>
      channelsApi.update(serverId, channelId, changes),
  );
}

export function useDeleteChannel(serverId: string) {
  return useChannelMutation(serverId, (channelId: string) =>
    channelsApi.remove(serverId, channelId),
  );
}

/** The sidebar is re-read rather than patched: ordering is the server's call. */
function useChannelMutation<TInput, TResult>(
  serverId: string,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.channels(serverId) }),
  });
}

export function useSetRoleOverride(serverId: string, channelId: string) {
  return useOverrideMutation(
    serverId,
    channelId,
    ({ roleId, ...bits }: { roleId: string } & OverrideInput) =>
      channelsApi.setRoleOverride(serverId, channelId, roleId, bits),
  );
}

export function useSetMemberOverride(serverId: string, channelId: string) {
  return useOverrideMutation(
    serverId,
    channelId,
    ({ userId, ...bits }: { userId: string } & OverrideInput) =>
      channelsApi.setMemberOverride(serverId, channelId, userId, bits),
  );
}

/**
 * An override changes both the override list and what the caller may do in the
 * channel, so the sidebar's own permissions are re-read with it.
 */
function useOverrideMutation<TInput>(
  serverId: string,
  channelId: string,
  mutationFn: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.channelOverrides(serverId, channelId) });
      void queryClient.invalidateQueries({ queryKey: keys.channels(serverId) });
    },
  });
}

/** Channels first inside each category heading, in the order the API sent them. */
export function groupByCategory(channels: Channel[]): {
  category: Channel | null;
  channels: Channel[];
}[] {
  const categories = channels.filter((channel) => channel.type === 'CATEGORY');
  const inCategory = (parentId: string | null) =>
    channels.filter((channel) => channel.type !== 'CATEGORY' && channel.parentId === parentId);

  // Channels whose category is hidden from this member land in the top group with
  // the genuinely uncategorised ones, rather than disappearing.
  const visibleIds = new Set(categories.map((category) => category.id));
  const loose = channels.filter(
    (channel) =>
      channel.type !== 'CATEGORY' &&
      (channel.parentId === null || !visibleIds.has(channel.parentId)),
  );

  return [
    ...(loose.length > 0 ? [{ category: null, channels: loose }] : []),
    ...categories.map((category) => ({ category, channels: inCategory(category.id) })),
  ];
}
