import * as bcrypt from 'bcryptjs';

/**
 * Hash an OTP code before storing in database
 * Uses bcrypt with default salt rounds (10)
 */
export async function hashOTP(otp: string): Promise<string> {
  return await bcrypt.hash(otp, 10);
}

/**
 * Verify an OTP code against its hash
 */
export async function verifyOTPHash(otp: string, codeHash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(otp, codeHash);
  } catch {
    return false;
  }
}
