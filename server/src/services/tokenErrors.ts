import { unauthorized } from '../utils/errors.js';

export const unacceptableToken = () => unauthorized('Session is invalid or has expired');
