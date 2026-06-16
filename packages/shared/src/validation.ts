import { Profile } from './types';

const VALID_PROFILES: Profile[] = ['development', 'production', 'staging'];

export function isValidProfile(value: string): value is Profile {
  return VALID_PROFILES.includes(value as Profile);
}

export function assertValidProfile(value: string): Profile {
  if (!isValidProfile(value)) {
    throw new Error(`Invalid profile: ${value}. Must be one of: ${VALID_PROFILES.join(', ')}`);
  }
  return value;
}

export function assertRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field: ${fieldName}`);
  }
}
