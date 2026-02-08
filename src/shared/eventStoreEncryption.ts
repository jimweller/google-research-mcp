// src/shared/eventStoreEncryption.ts

import * as crypto from 'node:crypto';
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { EncryptionOptions } from './types/eventStore.js';
import { logger } from './logger.js';

// Define a more specific type for our encrypted messages
interface EncryptedMessage {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params: {
    iv: string;
    encryptedData: string;
    authTag: string;
    algorithm: string;
  };
}

// Define a more specific type for error messages
interface ErrorMessage {
  jsonrpc: "2.0";
  id?: string | number;
  error: {
    code: number;
    message: string;
  };
}

/**
 * Custom error class for encryption/decryption failures.
 * Prevents silent fallback to plaintext storage.
 */
export class EncryptionError extends Error {
  public readonly operation: 'encrypt' | 'decrypt';
  public readonly cause?: unknown;

  constructor(operation: 'encrypt' | 'decrypt', message: string, cause?: unknown) {
    super(`Encryption ${operation} failed: ${message}`);
    this.name = 'EncryptionError';
    this.operation = operation;
    this.cause = cause;
  }
}

/**
 * Handles encryption and decryption of event data
 */
export class EventStoreEncryption {
  private options: EncryptionOptions;
  
  /**
   * Creates a new EventStoreEncryption instance
   * 
   * @param options - Encryption options
   */
  constructor(options: EncryptionOptions) {
    this.options = options;
  }
  
  /**
   * Encrypts a JSON-RPC message
   * 
   * @param message - The message to encrypt
   * @returns A special message that contains the encrypted data
   */
  async encryptMessage(message: JSONRPCMessage): Promise<JSONRPCMessage> {
    if (!this.options.enabled) return message;
    
    try {
      const key = await this.options.keyProvider();
      const algorithm = this.options.algorithm || 'aes-256-gcm';
      
      // Create a new initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher with GCM mode
      const cipher = crypto.createCipheriv(algorithm, key, iv) as crypto.CipherGCM;
      
      // Encrypt the message
      const messageStr = JSON.stringify(message);
      let encrypted = cipher.update(messageStr, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the authentication tag (only available with GCM mode)
      const authTag = cipher.getAuthTag();
      
      // Return a special message that indicates it's encrypted
      const encryptedMessage: EncryptedMessage = {
        jsonrpc: "2.0",
        // Safely copy the ID if it exists
        ...(typeof message === 'object' && message && 'id' in message ? { id: message.id } : {}),
        method: "__encrypted",
        params: {
          iv: iv.toString('hex'),
          encryptedData: encrypted,
          authTag: authTag.toString('hex'),
          algorithm
        }
      };
      
      return encryptedMessage as unknown as JSONRPCMessage;
    } catch (error) {
      logger.error('Failed to encrypt message', { error: String(error) });
      throw new EncryptionError(
        'encrypt',
        error instanceof Error ? error.message : String(error),
        error
      );
    }
  }
  
  /**
   * Decrypts a JSON-RPC message
   * 
   * @param message - The message to decrypt
   * @returns The decrypted message
   */
  async decryptMessage(message: JSONRPCMessage): Promise<JSONRPCMessage> {
    if (!this.options.enabled) return message;
    
    // Check if this is an encrypted message
    const msg = message as any;
    if (msg.method !== "__encrypted") return message;
    
    try {
      const key = await this.options.keyProvider();
      const params = msg.params;
      
      // Convert hex strings back to buffers
      const iv = Buffer.from(params.iv, 'hex');
      const authTag = Buffer.from(params.authTag, 'hex');
      
      // Create decipher with GCM mode
      const decipher = crypto.createDecipheriv(params.algorithm, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      let decrypted = decipher.update(params.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Parse the decrypted JSON string back to a message object
      return JSON.parse(decrypted) as JSONRPCMessage;
    } catch (error) {
      logger.error('SECURITY: Failed to decrypt message. Possible key mismatch or data corruption', { error: String(error) });
      
      // Return a special error message
      const errorMessage: ErrorMessage = {
        jsonrpc: "2.0",
        // Safely copy the ID if it exists
        ...(typeof message === 'object' && message && 'id' in message ? { id: message.id } : {}),
        error: {
          code: -32000,
          message: "Failed to decrypt message"
        }
      };
      
      return errorMessage as unknown as JSONRPCMessage;
    }
  }
}

/**
 * Sanitizes sensitive data from a JSON-RPC message
 * 
 * @param message - The message to sanitize
 * @returns A sanitized copy of the message
 */
export function sanitizeMessage(message: JSONRPCMessage): JSONRPCMessage {
  // Create a deep copy to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify(message));
  
  // Check if this is a request message with method and params
  const msg = sanitized as any;
  if (msg.method && msg.params) {
    // Remove sensitive fields based on method
    if (msg.method === "authenticate") {
      if (msg.params.password) {
        msg.params.password = "[REDACTED]";
      }
      if (msg.params.token) {
        msg.params.token = "[REDACTED]";
      }
    }
    
    // Sanitize any other methods that might contain sensitive data
    if (msg.params.apiKey) {
      msg.params.apiKey = "[REDACTED]";
    }
    
    if (msg.params.credentials) {
      msg.params.credentials = "[REDACTED]";
    }
  }
  
  return sanitized;
}