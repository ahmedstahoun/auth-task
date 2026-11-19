import mongoose from 'mongoose';
import { applyMongooseHardening } from './mongo.config';

describe('applyMongooseHardening', () => {
  it('enables strictQuery and sanitizeFilter globally', () => {
    applyMongooseHardening();
    expect(mongoose.get('strictQuery')).toBe(true);
    expect(mongoose.get('sanitizeFilter')).toBe(true);
  });
});
