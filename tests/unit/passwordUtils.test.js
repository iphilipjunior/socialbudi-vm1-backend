const { hashPassword, comparePassword, SALT_ROUNDS } = require('../../src/utils/passwordUtils');

describe('passwordUtils', () => {
  const testPassword = 'SecurePassword123!';

  describe('hashPassword', () => {
    it('should return a bcrypt hash string', async () => {
      const hash = await hashPassword(testPassword);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.startsWith('$2')).toBe(true); // bcrypt hash starts with $2
    });

    it('should produce different hashes for the same password (due to salt)', async () => {
      const hash1 = await hashPassword(testPassword);
      const hash2 = await hashPassword(testPassword);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce hash with correct bcrypt format', async () => {
      const hash = await hashPassword(testPassword);

      // bcrypt format: $2b$10$<22 char salt><31 char hash>
      const parts = hash.split('$');
      expect(parts.length).toBe(4);
      expect(parts[1]).toBe('2b'); // bcrypt version
      expect(parts[2]).toBe(String(SALT_ROUNDS)); // salt rounds
    });

    it('should throw error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Failed to hash password');
    });

    it('should throw error for null password', async () => {
      await expect(hashPassword(null)).rejects.toThrow('Failed to hash password');
    });

    it('should throw error for undefined password', async () => {
      await expect(hashPassword(undefined)).rejects.toThrow('Failed to hash password');
    });

    it('should handle passwords with special characters', async () => {
      const specialPassword = 'P@$$w0rd!#%^&*()_+-=[]{}|;:,.<>?';
      const hash = await hashPassword(specialPassword);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$2')).toBe(true);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(100);
      const hash = await hashPassword(longPassword);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$2')).toBe(true);
    });
  });

  describe('comparePassword', () => {
    let hashedPassword;

    beforeEach(async () => {
      hashedPassword = await hashPassword(testPassword);
    });

    it('should return true for correct password', async () => {
      const result = await comparePassword(testPassword, hashedPassword);

      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const result = await comparePassword('WrongPassword123!', hashedPassword);

      expect(result).toBe(false);
    });

    it('should return false for empty password', async () => {
      const result = await comparePassword('', hashedPassword);

      expect(result).toBe(false);
    });

    it('should return false for null password', async () => {
      const result = await comparePassword(null, hashedPassword);

      expect(result).toBe(false);
    });

    it('should return false for null hash', async () => {
      const result = await comparePassword(testPassword, null);

      expect(result).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const result = await comparePassword(testPassword, 'not-a-valid-hash');

      expect(result).toBe(false);
    });

    it('should return false for both parameters empty', async () => {
      const result = await comparePassword('', '');

      expect(result).toBe(false);
    });

    it('should handle case-sensitive password comparison', async () => {
      const result = await comparePassword('securepassword123!', hashedPassword);

      expect(result).toBe(false); // Original was 'SecurePassword123!'
    });

    it('should handle passwords with whitespace correctly', async () => {
      const passwordWithSpace = 'Password With Spaces';
      const hash = await hashPassword(passwordWithSpace);
      const result = await comparePassword(passwordWithSpace, hash);

      expect(result).toBe(true);
    });

    it('should return false when whitespace differs', async () => {
      const passwordWithSpace = 'Password With Spaces';
      const hash = await hashPassword(passwordWithSpace);
      const result = await comparePassword('PasswordWithSpaces', hash);

      expect(result).toBe(false);
    });
  });

  describe('SALT_ROUNDS', () => {
    it('should be exactly 10', () => {
      expect(SALT_ROUNDS).toBe(10);
    });
  });
});
