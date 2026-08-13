/**
 * How a friendship pair is stored.
 *
 * One row holds the relationship between two people, which only works if both
 * sides of a pair always land on the same row — so the lower id is always
 * `userId`. `@@unique([userId, friendId])` then makes a duplicate impossible:
 * without this, A asking B and B asking A would be two rows that both look
 * pending, and the constraint would never fire.
 *
 * Direction is not lost by sorting — `requestedBy` carries it.
 *
 * This lives in shared because the API and the seed both write these rows, and a
 * second copy of the rule would eventually order a pair the other way round and
 * make the row unfindable.
 */
export function friendshipPair(a: string, b: string): { userId: string; friendId: string } {
  return a < b ? { userId: a, friendId: b } : { userId: b, friendId: a };
}
