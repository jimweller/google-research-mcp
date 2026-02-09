/**
 * Document Parsing Types
 *
 * Type definitions for document parsing functionality.
 */

// ── Document Types ─────────────────────────────────────────────────────────

export enum DocumentType {
  PDF = 'pdf',
  DOCX = 'docx',
  PPTX = 'pptx',
  UNKNOWN = 'unknown',
}

// ── Error Types ────────────────────────────────────────────────────────────

export enum DocumentParseErrorType {
  /** File format is not supported */
  UNSUPPORTED_FORMAT = 'unsupported_format',
  /** File is corrupted or invalid */
  CORRUPTED_FILE = 'corrupted_file',
  /** File is password protected */
  PASSWORD_PROTECTED = 'password_protected',
  /** File exceeds size limit */
  FILE_TOO_LARGE = 'file_too_large',
  /** Text extraction failed */
  EXTRACTION_FAILED = 'extraction_failed',
  /** Network error fetching the document */
  NETWORK_ERROR = 'network_error',
}

// ── Result Types ───────────────────────────────────────────────────────────

export interface DocumentParseError {
  type: DocumentParseErrorType;
  message: string;
  details?: string;
}

export interface DocumentMetadata {
  /** Document title (if extractable) */
  title?: string;
  /** Author (if extractable) */
  author?: string;
  /** Number of pages/slides */
  pageCount?: number;
  /** Creation date */
  createdAt?: Date;
  /** File size in bytes */
  fileSize?: number;
}

export interface DocumentParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Extracted text content */
  content?: string;
  /** Detected document type */
  documentType: DocumentType;
  /** Document metadata */
  metadata?: DocumentMetadata;
  /** Error details if parsing failed */
  error?: DocumentParseError;
}

// ── Configuration ──────────────────────────────────────────────────────────

export interface DocumentParseOptions {
  /** Maximum file size in bytes (default: 10 MB) */
  maxFileSize?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to extract metadata (default: true) */
  extractMetadata?: boolean;
}

/** Default maximum file size: 10 MB */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Default request timeout: 30 seconds */
export const DEFAULT_TIMEOUT = 30_000;
