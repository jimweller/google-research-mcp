import { describe, it, expect } from '@jest/globals';
import { validateUrlForSSRF, SSRFProtectionError } from './urlValidator.js';

describe('SSRF URL Validator', () => {
  describe('Protocol validation', () => {
    it('should allow http URLs', async () => {
      // Public DNS will resolve — no throw expected for valid public URLs
      await expect(validateUrlForSSRF('http://www.google.com')).resolves.toBeUndefined();
    });

    it('should allow https URLs', async () => {
      await expect(validateUrlForSSRF('https://www.google.com')).resolves.toBeUndefined();
    });

    it('should block ftp protocol', async () => {
      await expect(validateUrlForSSRF('ftp://example.com/file')).rejects.toThrow(SSRFProtectionError);
    });

    it('should block file protocol', async () => {
      await expect(validateUrlForSSRF('file:///etc/passwd')).rejects.toThrow(SSRFProtectionError);
    });

    it('should block invalid URLs', async () => {
      await expect(validateUrlForSSRF('not-a-url')).rejects.toThrow(SSRFProtectionError);
    });
  });

  describe('Private IP blocking', () => {
    it('should block localhost 127.0.0.1', async () => {
      await expect(validateUrlForSSRF('http://127.0.0.1/secret')).rejects.toThrow(SSRFProtectionError);
    });

    it('should block 10.x.x.x range', async () => {
      await expect(validateUrlForSSRF('http://10.0.0.1/internal')).rejects.toThrow(SSRFProtectionError);
    });

    it('should block 192.168.x.x range', async () => {
      await expect(validateUrlForSSRF('http://192.168.1.1/admin')).rejects.toThrow(SSRFProtectionError);
    });

    it('should block 172.16.x.x range', async () => {
      await expect(validateUrlForSSRF('http://172.16.0.1/')).rejects.toThrow(SSRFProtectionError);
    });

    it('should block 0.0.0.0', async () => {
      await expect(validateUrlForSSRF('http://0.0.0.0/')).rejects.toThrow(SSRFProtectionError);
    });
  });

  describe('Cloud metadata endpoint blocking', () => {
    it('should block AWS metadata endpoint (169.254.169.254)', async () => {
      await expect(validateUrlForSSRF('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(SSRFProtectionError);
    });

    it('should block GCP metadata hostname', async () => {
      await expect(validateUrlForSSRF('http://metadata.google.internal/')).rejects.toThrow(SSRFProtectionError);
    });
  });

  describe('IPv6 blocking', () => {
    it('should block IPv6 loopback [::1]', async () => {
      await expect(validateUrlForSSRF('http://[::1]/')).rejects.toThrow(SSRFProtectionError);
    });
  });

  describe('Public URL allowance', () => {
    it('should allow public URLs', async () => {
      await expect(validateUrlForSSRF('https://www.example.com')).resolves.toBeUndefined();
    });

    it('should allow YouTube URLs', async () => {
      await expect(validateUrlForSSRF('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).resolves.toBeUndefined();
    });
  });

  describe('DNS resolution blocking', () => {
    it('should block localhost hostname', async () => {
      await expect(validateUrlForSSRF('http://localhost/secret')).rejects.toThrow(SSRFProtectionError);
    });
  });
});
