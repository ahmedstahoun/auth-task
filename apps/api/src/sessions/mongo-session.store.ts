import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, trusted } from 'mongoose';
import { sha256 } from './hash';
import {
  LOGIN_ATTEMPT_MODEL,
  SESSION_MODEL,
  type LoginAttemptDocument,
  type SessionDocument,
} from './session.schemas';
import {
  SessionStore,
  type NewSession,
  type RotationResult,
  type SessionRecord,
} from './session-store';

type StoredSession = SessionDocument & { _id: string; createdAt: Date };

function toRecord(doc: StoredSession): SessionRecord {
  return {
    id: doc._id,
    userId: doc.userId,
    userAgent: doc.userAgent ?? null,
    ip: doc.ip ?? null,
    createdAt: doc.createdAt,
    lastUsedAt: doc.lastUsedAt,
    expiresAt: doc.expiresAt,
  };
}

/** `expiresAt > now` — our own operator, explicitly trusted past `sanitizeFilter`. */
const notExpired = (): { $gt: Date } => trusted({ $gt: new Date() });

@Injectable()
export class MongoSessionStore extends SessionStore {
  constructor(
    @InjectModel(SESSION_MODEL) private readonly sessions: Model<SessionDocument>,
    @InjectModel(LOGIN_ATTEMPT_MODEL) private readonly attempts: Model<LoginAttemptDocument>,
  ) {
    super();
  }

  async create(session: NewSession): Promise<SessionRecord> {
    const now = new Date();
    const created = await this.sessions.create({
      _id: session.id,
      userId: session.userId,
      refreshJtiHash: sha256(session.refreshJti),
      userAgent: session.userAgent,
      ip: session.ip,
      lastUsedAt: now,
      expiresAt: session.expiresAt,
    });
    return toRecord(created.toObject<StoredSession>());
  }

  async findActive(sessionId: string): Promise<SessionRecord | null> {
    const doc = await this.sessions
      .findOne({ _id: sessionId, expiresAt: notExpired() })
      .lean<StoredSession>()
      .exec();
    return doc ? toRecord(doc) : null;
  }

  async rotate(sessionId: string, presentedJti: string, nextJti: string): Promise<RotationResult> {
    // Single conditional update: only the holder of the current jti can rotate. Two concurrent
    // refreshes with the same token → exactly one wins, the other is treated as reuse.
    const updated = await this.sessions
      .findOneAndUpdate(
        { _id: sessionId, refreshJtiHash: sha256(presentedJti), expiresAt: notExpired() },
        { $set: { refreshJtiHash: sha256(nextJti), lastUsedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .lean<StoredSession>()
      .exec();
    if (updated) return { status: 'rotated', session: toRecord(updated) };

    const existing = await this.findActive(sessionId);
    return existing
      ? { status: 'reuse_detected', userId: existing.userId }
      : { status: 'not_found' };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessions.deleteOne({ _id: sessionId }).exec();
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.sessions.deleteMany({ userId }).exec();
    return result.deletedCount;
  }

  async listActiveForUser(userId: string): Promise<SessionRecord[]> {
    const docs = await this.sessions
      .find({ userId, expiresAt: notExpired() })
      .sort({ lastUsedAt: -1 })
      .lean<StoredSession[]>()
      .exec();
    return docs.map(toRecord);
  }

  async registerFailedLogin(email: string, windowSeconds: number): Promise<number> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
    const stillOpen = { $gt: ['$expiresAt', now] };
    // Atomic upsert via an update pipeline: increment inside an open window, otherwise restart it.
    const doc = await this.attempts
      .findOneAndUpdate(
        { _id: email },
        [
          {
            $set: {
              count: { $cond: [stillOpen, { $add: ['$count', 1] }, 1] },
              expiresAt: { $cond: [stillOpen, '$expiresAt', windowEnd] },
            },
          },
        ],
        { upsert: true, returnDocument: 'after', updatePipeline: true },
      )
      .lean<LoginAttemptDocument>()
      .exec();
    // upsert + returnDocument:'after' always yields a document.
    return doc.count;
  }

  async countFailedLogins(email: string): Promise<number> {
    const doc = await this.attempts
      .findOne({ _id: email, expiresAt: notExpired() })
      .lean<LoginAttemptDocument>()
      .exec();
    return doc?.count ?? 0;
  }

  async clearFailedLogins(email: string): Promise<void> {
    await this.attempts.deleteOne({ _id: email }).exec();
  }
}
