import mongoose from 'mongoose';
import { badRequest } from './errors.js';

export function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

export function toObjectId(id: string, label = 'id'): mongoose.Types.ObjectId {
  if (!isValidObjectId(id)) throw badRequest(`Invalid ${label}`);
  return new mongoose.Types.ObjectId(id);
}

export function sameId(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}

export function uniqueObjectIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => isValidObjectId(id)))];
}
