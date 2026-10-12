export interface SmsProvider {
  /** Send a verification code SMS to the given E.164 phone number. The provider owns OTP generation. */
  sendVerificationCode(phoneNumber: string): Promise<void>;
  /** Optional provider-owned code verification. When omitted, Better Auth handles verification. */
  verifyCode?(phoneNumber: string, code: string): Promise<boolean>;
}
