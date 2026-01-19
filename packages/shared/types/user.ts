export interface User {
  _id: string;
  _creationTime: number;
  email: string;
  emailVerified: boolean;
  name: string | null;
  createdAt: number;
}

export interface CreateUserInput {
  email: string;
  name?: string;
}

export interface AuthError {
  message: string;
  code?: string;
}

export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'DUPLICATE_ACCOUNT'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'VERIFICATION_FAILED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';
