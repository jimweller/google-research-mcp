/**
 * Document Parsing Module
 *
 * Exports for document parsing functionality (PDF, DOCX, PPTX).
 */

export {
  DocumentType,
  DocumentParseErrorType,
  type DocumentParseResult,
  type DocumentParseOptions,
  type DocumentParseError,
  type DocumentMetadata,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_TIMEOUT,
} from './types.js';

export {
  detectDocumentType,
  isDocumentUrl,
  parseDocument,
} from './documentParser.js';
