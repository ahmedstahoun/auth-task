import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { sha256 } from '../../common/utils/hash';
import type { SessionsRepository } from '../interfaces/sessions-repository.interface';
import type { NewSession, RotationResult, Session } from '../models/session.model';
import { SESSION_MODEL, type SessionDocument } from '../schemas/session.schema';
import { notExpired } from './mongo-filters';

type StoredSession = SessionDocument & { _id: string; createdAt: Date };

function toSession(doc: StoredSession): Session {
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

@Injectable()
export class MongoSessionsRepository implements SessionsRepository {
  constructor(@InjectModel(SESSION_MODEL) private readonly sessions: Model<SessionDocument>) {}

  async create(session: NewSession): Promise<Session> {
    const created = await this.sessions.create({
      _id: session.id,
      userId: session.userId,
      refreshJtiHash: sha256(session.refreshJti),
      userAgent: session.userAgent,
      ip: session.ip,
      lastUsedAt: new Date(),
      expiresAt: session.expiresAt,
    });
    return toSession(created.toObject<StoredSession>());
  }

  async findActive(sessionId: string): Promise<Session | null> {
    const doc = await this.sessions
      .findOne({ _id: sessionId, expiresAt: notExpired() })
      .lean<StoredSession>()
      .exec();
    return doc ? toSession(doc) : null;
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
    if (updated) return { status: 'rotated', session: toSession(updated) };

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

  async listActiveForUser(userId: string): Promise<Session[]> {
    const docs = await this.sessions
      .find({ userId, expiresAt: notExpired() })
      .sort({ lastUsedAt: -1 })
      .lean<StoredSession[]>()
      .exec();
    return docs.map(toSession);
  }
}
