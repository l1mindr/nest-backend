export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}
