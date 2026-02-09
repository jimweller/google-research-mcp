/**
 * Tests for Environment Variable Validation Module
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  validateEnvironment,
  validateEnvVar,
  formatValidationError,
  getValidatedEnvValue,
  ENV_VALIDATION_RULES,
  type EnvValidationRule,
  type ValidationError,
} from './envValidator.js';

describe('envValidator', () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment to a clean state
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateEnvVar', () => {
    describe('GOOGLE_CUSTOM_SEARCH_API_KEY', () => {
      const rule = ENV_VALIDATION_RULES.find(r => r.name === 'GOOGLE_CUSTOM_SEARCH_API_KEY')!;

      it('accepts valid API key format', () => {
        const validKey = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
        const result = validateEnvVar(rule, validKey);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('accepts API key with dashes and underscores', () => {
        const validKey = 'AIzaSyA1B2C3D4E5F6G7H8I9-0K1_2M3N4O5P6Q';
        const result = validateEnvVar(rule, validKey);
        expect(result.valid).toBe(true);
      });

      it('rejects API key without AIzaSy prefix', () => {
        const invalidKey = 'INVALID_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O';
        const result = validateEnvVar(rule, invalidKey);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_format');
        expect(result.error?.variable).toBe('GOOGLE_CUSTOM_SEARCH_API_KEY');
      });

      it('rejects API key that is too short', () => {
        const invalidKey = 'AIzaSyA1B2C3';
        const result = validateEnvVar(rule, invalidKey);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_format');
      });

      it('rejects API key that is too long', () => {
        const invalidKey = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6QEXTRA';
        const result = validateEnvVar(rule, invalidKey);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_format');
      });

      it('rejects missing required API key', () => {
        const result = validateEnvVar(rule, undefined);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('missing');
      });

      it('rejects empty string as API key', () => {
        const result = validateEnvVar(rule, '');
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('missing');
      });
    });

    describe('GOOGLE_CUSTOM_SEARCH_ID', () => {
      const rule = ENV_VALIDATION_RULES.find(r => r.name === 'GOOGLE_CUSTOM_SEARCH_ID')!;

      it('accepts valid Search Engine ID with colon', () => {
        const validId = '017576662512468239146:omuauf_gy1x';
        const result = validateEnvVar(rule, validId);
        expect(result.valid).toBe(true);
      });

      it('accepts alphanumeric-only Search Engine ID', () => {
        const validId = '56a696a31579545bf';
        const result = validateEnvVar(rule, validId);
        expect(result.valid).toBe(true);
      });

      it('rejects Search Engine ID that is too short', () => {
        const invalidId = 'abc123';
        const result = validateEnvVar(rule, invalidId);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_format');
      });

      it('rejects Search Engine ID with invalid characters', () => {
        const invalidId = 'invalid@search#id!';
        const result = validateEnvVar(rule, invalidId);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_format');
      });
    });

    describe('OAUTH_ISSUER_URL', () => {
      const rule = ENV_VALIDATION_RULES.find(r => r.name === 'OAUTH_ISSUER_URL')!;

      it('accepts valid HTTPS URL', () => {
        const validUrl = 'https://auth.example.com';
        const result = validateEnvVar(rule, validUrl);
        expect(result.valid).toBe(true);
      });

      it('accepts HTTPS URL with port', () => {
        const validUrl = 'https://auth.example.com:8443';
        const result = validateEnvVar(rule, validUrl);
        expect(result.valid).toBe(true);
      });

      it('accepts HTTPS URL with path', () => {
        const validUrl = 'https://auth.example.com/oauth2/issuer';
        const result = validateEnvVar(rule, validUrl);
        expect(result.valid).toBe(true);
      });

      it('rejects HTTP URL (must be HTTPS)', () => {
        const invalidUrl = 'http://auth.example.com';
        const result = validateEnvVar(rule, invalidUrl);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_format');
      });

      it('rejects malformed URL', () => {
        const invalidUrl = 'not-a-url';
        const result = validateEnvVar(rule, invalidUrl);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_format');
      });

      it('accepts undefined (optional)', () => {
        const result = validateEnvVar(rule, undefined);
        expect(result.valid).toBe(true);
      });
    });

    describe('EVENT_STORE_ENCRYPTION_KEY', () => {
      const rule = ENV_VALIDATION_RULES.find(r => r.name === 'EVENT_STORE_ENCRYPTION_KEY')!;

      it('accepts valid 64-char hex key', () => {
        const validKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        const result = validateEnvVar(rule, validKey);
        expect(result.valid).toBe(true);
      });

      it('accepts uppercase hex characters', () => {
        const validKey = '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF';
        const result = validateEnvVar(rule, validKey);
        expect(result.valid).toBe(true);
      });

      it('rejects key that is too short', () => {
        const invalidKey = '0123456789abcdef';
        const result = validateEnvVar(rule, invalidKey);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_format');
      });

      it('rejects key with non-hex characters', () => {
        const invalidKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789ghijkl';
        const result = validateEnvVar(rule, invalidKey);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_format');
      });

      it('accepts undefined (optional)', () => {
        const result = validateEnvVar(rule, undefined);
        expect(result.valid).toBe(true);
      });
    });

    describe('PORT', () => {
      const rule = ENV_VALIDATION_RULES.find(r => r.name === 'PORT')!;

      it('accepts valid port number', () => {
        const result = validateEnvVar(rule, '3000');
        expect(result.valid).toBe(true);
      });

      it('accepts port 1', () => {
        const result = validateEnvVar(rule, '1');
        expect(result.valid).toBe(true);
      });

      it('accepts port 65535', () => {
        const result = validateEnvVar(rule, '65535');
        expect(result.valid).toBe(true);
      });

      it('rejects port 0', () => {
        const result = validateEnvVar(rule, '0');
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_value');
      });

      it('rejects port above 65535', () => {
        const result = validateEnvVar(rule, '70000');
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_value');
      });

      it('rejects non-numeric port', () => {
        const result = validateEnvVar(rule, 'abc');
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid_format');
      });
    });
  });

  describe('validateEnvironment', () => {
    it('returns valid when all required env vars are set correctly', () => {
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
      process.env.GOOGLE_CUSTOM_SEARCH_ID = '017576662512468239146:omuauf_gy1x';

      const result = validateEnvironment();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns invalid when required API key is missing', () => {
      delete process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
      process.env.GOOGLE_CUSTOM_SEARCH_ID = '017576662512468239146:omuauf_gy1x';

      const result = validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.variable === 'GOOGLE_CUSTOM_SEARCH_API_KEY')).toBe(true);
    });

    it('returns invalid when required Search ID is missing', () => {
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
      delete process.env.GOOGLE_CUSTOM_SEARCH_ID;

      const result = validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.variable === 'GOOGLE_CUSTOM_SEARCH_ID')).toBe(true);
    });

    it('returns invalid when API key format is wrong', () => {
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'invalid-key';
      process.env.GOOGLE_CUSTOM_SEARCH_ID = '017576662512468239146:omuauf_gy1x';

      const result = validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.variable === 'GOOGLE_CUSTOM_SEARCH_API_KEY' && e.type === 'invalid_format'
      )).toBe(true);
    });

    it('validates OAuth when requireOAuth option is true', () => {
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
      process.env.GOOGLE_CUSTOM_SEARCH_ID = '017576662512468239146:omuauf_gy1x';
      // Missing OAuth vars

      const result = validateEnvironment({ requireOAuth: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.variable === 'OAUTH_ISSUER_URL')).toBe(true);
      expect(result.errors.some(e => e.variable === 'OAUTH_AUDIENCE')).toBe(true);
    });

    it('passes when OAuth is required and both vars are set', () => {
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
      process.env.GOOGLE_CUSTOM_SEARCH_ID = '017576662512468239146:omuauf_gy1x';
      process.env.OAUTH_ISSUER_URL = 'https://auth.example.com';
      process.env.OAUTH_AUDIENCE = 'https://api.example.com';

      const result = validateEnvironment({ requireOAuth: true });
      expect(result.valid).toBe(true);
    });

    it('warns when only one OAuth var is set', () => {
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
      process.env.GOOGLE_CUSTOM_SEARCH_ID = '017576662512468239146:omuauf_gy1x';
      process.env.OAUTH_ISSUER_URL = 'https://auth.example.com';
      // OAUTH_AUDIENCE not set

      const result = validateEnvironment();
      expect(result.valid).toBe(true); // Still valid, just a warning
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('OAuth configuration is incomplete'))).toBe(true);
    });

    it('warns when ALLOW_PRIVATE_IPS is enabled', () => {
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
      process.env.GOOGLE_CUSTOM_SEARCH_ID = '017576662512468239146:omuauf_gy1x';
      process.env.ALLOW_PRIVATE_IPS = 'true';

      const result = validateEnvironment();
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.variable === 'ALLOW_PRIVATE_IPS')).toBe(true);
    });

    it('accepts additional custom rules', () => {
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
      process.env.GOOGLE_CUSTOM_SEARCH_ID = '017576662512468239146:omuauf_gy1x';

      const customRule: EnvValidationRule = {
        name: 'MY_CUSTOM_VAR',
        required: true,
        description: 'Custom variable for testing',
      };

      const result = validateEnvironment({ additionalRules: [customRule] });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.variable === 'MY_CUSTOM_VAR')).toBe(true);
    });
  });

  describe('formatValidationError', () => {
    it('formats missing error with expected and example', () => {
      const error: ValidationError = {
        variable: 'GOOGLE_CUSTOM_SEARCH_API_KEY',
        type: 'missing',
        message: 'Required environment variable GOOGLE_CUSTOM_SEARCH_API_KEY is not set',
        expected: 'Google API key must start with "AIzaSy"',
        example: 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q',
      };

      const formatted = formatValidationError(error);
      expect(formatted).toContain('ERROR:');
      expect(formatted).toContain('GOOGLE_CUSTOM_SEARCH_API_KEY');
      expect(formatted).toContain('Expected:');
      expect(formatted).toContain('Example:');
    });

    it('formats error without example', () => {
      const error: ValidationError = {
        variable: 'SOME_VAR',
        type: 'invalid_format',
        message: 'Invalid format',
        expected: 'Some format',
      };

      const formatted = formatValidationError(error);
      expect(formatted).toContain('ERROR:');
      expect(formatted).toContain('Expected:');
      expect(formatted).not.toContain('Example:');
    });
  });

  describe('getValidatedEnvValue', () => {
    it('returns undefined for unset optional variable', () => {
      delete process.env.OAUTH_ISSUER_URL;
      const value = getValidatedEnvValue('OAUTH_ISSUER_URL');
      expect(value).toBeUndefined();
    });

    it('returns value for valid variable', () => {
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
      const value = getValidatedEnvValue('GOOGLE_CUSTOM_SEARCH_API_KEY');
      expect(value).toBe('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q');
    });

    it('throws for invalid value', () => {
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'invalid-key';
      expect(() => getValidatedEnvValue('GOOGLE_CUSTOM_SEARCH_API_KEY')).toThrow();
    });

    it('returns value for unknown variable (no rule defined)', () => {
      process.env.UNKNOWN_VAR = 'some-value';
      const value = getValidatedEnvValue('UNKNOWN_VAR');
      expect(value).toBe('some-value');
    });
  });
});
