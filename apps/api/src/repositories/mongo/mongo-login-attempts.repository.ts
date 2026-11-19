import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { LoginAttemptsRepository } from '../interfaces/login-attempts-repository.interface';
import { LOGIN_ATTEMPT_MODEL, type LoginAttemptDocument } from '../schemas/login-attempt.schema';
import { notExpired } from './mongo-filters';

@Injectable()
export class MongoLoginAttemptsRepository implements LoginAttemptsRepository {
  constructor(
    @InjectModel(LOGIN_ATTEMPT_MODEL) private readonly attempts: Model<LoginAttemptDocument>,
  ) {}

  async registerFailure(email: string, windowSeconds: number): Promise<number> {
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

  async countFailures(email: string): Promise<number> {
    const doc = await this.attempts
      .findOne({ _id: email, expiresAt: notExpired() })
      .lean<LoginAttemptDocument>()
      .exec();
    return doc?.count ?? 0;
  }

  async clear(email: string): Promise<void> {
    await this.attempts.deleteOne({ _id: email }).exec();
  }
}
