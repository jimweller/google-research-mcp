/**
 * Tests for Document Parser Module
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  detectDocumentType,
  isDocumentUrl,
  DocumentType,
} from './index.js';

// Note: Integration tests with actual parsing are in E2E tests
// Unit tests focus on type detection and URL handling

describe('documentParser', () => {
  describe('detectDocumentType', () => {
    describe('from Content-Type header', () => {
      it('detects PDF from application/pdf', () => {
        expect(detectDocumentType('https://example.com/file', 'application/pdf')).toBe(DocumentType.PDF);
      });

      it('detects PDF from content type with charset', () => {
        expect(detectDocumentType('https://example.com/file', 'application/pdf; charset=utf-8')).toBe(DocumentType.PDF);
      });

      it('detects DOCX from wordprocessingml content type', () => {
        expect(detectDocumentType(
          'https://example.com/file',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )).toBe(DocumentType.DOCX);
      });

      it('detects PPTX from presentationml content type', () => {
        expect(detectDocumentType(
          'https://example.com/file',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        )).toBe(DocumentType.PPTX);
      });

      it('returns UNKNOWN for unsupported content type', () => {
        expect(detectDocumentType('https://example.com/file', 'text/html')).toBe(DocumentType.UNKNOWN);
        expect(detectDocumentType('https://example.com/file', 'image/png')).toBe(DocumentType.UNKNOWN);
      });
    });

    describe('from URL extension', () => {
      it('detects PDF from .pdf extension', () => {
        expect(detectDocumentType('https://example.com/document.pdf')).toBe(DocumentType.PDF);
        expect(detectDocumentType('https://example.com/path/to/file.PDF')).toBe(DocumentType.PDF);
      });

      it('detects DOCX from .docx extension', () => {
        expect(detectDocumentType('https://example.com/document.docx')).toBe(DocumentType.DOCX);
        expect(detectDocumentType('https://example.com/path/to/file.DOCX')).toBe(DocumentType.DOCX);
      });

      it('detects PPTX from .pptx extension', () => {
        expect(detectDocumentType('https://example.com/slides.pptx')).toBe(DocumentType.PPTX);
        expect(detectDocumentType('https://example.com/path/to/presentation.PPTX')).toBe(DocumentType.PPTX);
      });

      it('handles URLs with query parameters', () => {
        expect(detectDocumentType('https://example.com/document.pdf?token=abc123')).toBe(DocumentType.PDF);
      });

      it('returns UNKNOWN for non-document extensions', () => {
        expect(detectDocumentType('https://example.com/page.html')).toBe(DocumentType.UNKNOWN);
        expect(detectDocumentType('https://example.com/image.png')).toBe(DocumentType.UNKNOWN);
        expect(detectDocumentType('https://example.com/script.js')).toBe(DocumentType.UNKNOWN);
      });

      it('returns UNKNOWN for URLs without extension', () => {
        expect(detectDocumentType('https://example.com/document')).toBe(DocumentType.UNKNOWN);
        expect(detectDocumentType('https://example.com/')).toBe(DocumentType.UNKNOWN);
      });

      it('returns UNKNOWN for old Office formats', () => {
        expect(detectDocumentType('https://example.com/document.doc')).toBe(DocumentType.UNKNOWN);
        expect(detectDocumentType('https://example.com/slides.ppt')).toBe(DocumentType.UNKNOWN);
        expect(detectDocumentType('https://example.com/data.xls')).toBe(DocumentType.UNKNOWN);
      });
    });

    describe('priority: Content-Type over URL', () => {
      it('uses Content-Type when both are available', () => {
        // URL says docx, Content-Type says pdf - Content-Type wins
        expect(detectDocumentType('https://example.com/doc.docx', 'application/pdf')).toBe(DocumentType.PDF);
      });

      it('falls back to URL when Content-Type is generic', () => {
        expect(detectDocumentType('https://example.com/doc.pdf', 'application/octet-stream')).toBe(DocumentType.PDF);
      });
    });

    describe('edge cases', () => {
      it('handles invalid URLs gracefully', () => {
        expect(detectDocumentType('not-a-url')).toBe(DocumentType.UNKNOWN);
        expect(detectDocumentType('')).toBe(DocumentType.UNKNOWN);
      });

      it('handles URLs with fragments', () => {
        expect(detectDocumentType('https://example.com/doc.pdf#page=5')).toBe(DocumentType.PDF);
      });
    });
  });

  describe('isDocumentUrl', () => {
    it('returns true for document URLs', () => {
      expect(isDocumentUrl('https://example.com/doc.pdf')).toBe(true);
      expect(isDocumentUrl('https://example.com/doc.docx')).toBe(true);
      expect(isDocumentUrl('https://example.com/doc.pptx')).toBe(true);
    });

    it('returns false for non-document URLs', () => {
      expect(isDocumentUrl('https://example.com/page.html')).toBe(false);
      expect(isDocumentUrl('https://example.com/')).toBe(false);
      expect(isDocumentUrl('https://example.com/image.png')).toBe(false);
    });
  });
});
