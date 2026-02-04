/**
 * Mapping Generator Module
 * Converts detected patterns into SITE_MAPPINGS format for bulk crawler
 */

import type { PatternResult, SiteMapping, FieldMapping } from './patternDetector';

export interface GeneratedMapping extends SiteMapping {
  _auto_detected: boolean;
  _detected_at: string;
  _pattern: string;
}

/**
 * 1. WordPress Contact Form 7 Mapping Generator
 * Maps your-* fields to standard field names
 */
export function generateWordPressCF7Mapping(
  url: string,
  result: PatternResult
): GeneratedMapping {
  const mapping: FieldMapping = {
    companyName: result.mapping.companyName || 'your-company',
    personName: result.mapping.personName || 'your-name',
    email: result.mapping.email || 'your-email',
    phone: result.mapping.phone || 'your-tel',
    inquiry: result.mapping.inquiry || 'your-message',
  };

  return {
    url,
    pattern: result.pattern,
    confidence: result.confidence,
    mapping,
    detectedAt: new Date().toISOString(),
    _auto_detected: true,
    _detected_at: new Date().toISOString(),
    _pattern: 'wordpress_cf7',
  };
}

/**
 * 2. Japanese Direct Mapping Generator
 * Maps Japanese field names directly
 */
export function generateJapaneseDirectMapping(
  url: string,
  result: PatternResult
): GeneratedMapping {
  const mapping: FieldMapping = {
    ...result.mapping,
  };

  return {
    url,
    pattern: result.pattern,
    confidence: result.confidence,
    mapping,
    detectedAt: new Date().toISOString(),
    _auto_detected: true,
    _detected_at: new Date().toISOString(),
    _pattern: 'japanese_direct',
  };
}

/**
 * 3. Required Marks Mapping Generator
 * Maps fields with (必須) markers
 */
export function generateRequiredMarksMapping(
  url: string,
  result: PatternResult
): GeneratedMapping {
  const mapping: FieldMapping = {
    ...result.mapping,
  };

  return {
    url,
    pattern: result.pattern,
    confidence: result.confidence,
    mapping,
    detectedAt: new Date().toISOString(),
    _auto_detected: true,
    _detected_at: new Date().toISOString(),
    _pattern: 'required_marks',
  };
}

/**
 * 4. MailForm CGI Mapping Generator
 * Maps F1, F2, Email1, Email2 fields
 */
export function generateMailFormCGIMapping(
  url: string,
  result: PatternResult
): GeneratedMapping {
  const mapping: FieldMapping = {
    ...result.mapping,
  };

  return {
    url,
    pattern: result.pattern,
    confidence: result.confidence,
    mapping,
    detectedAt: new Date().toISOString(),
    _auto_detected: true,
    _detected_at: new Date().toISOString(),
    _pattern: 'mailform_cgi',
  };
}

/**
 * 5. Split Fields Mapping Generator
 * Maps numbered sequential fields (name1, name2, etc.)
 */
export function generateSplitFieldsMapping(
  url: string,
  result: PatternResult
): GeneratedMapping {
  const mapping: FieldMapping = {
    ...result.mapping,
  };

  return {
    url,
    pattern: result.pattern,
    confidence: result.confidence,
    mapping,
    detectedAt: new Date().toISOString(),
    _auto_detected: true,
    _detected_at: new Date().toISOString(),
    _pattern: 'split_fields',
  };
}

/**
 * Main Mapping Generator
 * Delegates to specific generators based on detected pattern
 */
export function generateMapping(
  url: string,
  result: PatternResult
): GeneratedMapping | null {
  if (!result) {
    return null;
  }

  switch (result.pattern) {
    case 'wordpress_cf7':
      return generateWordPressCF7Mapping(url, result);
    case 'japanese_direct':
      return generateJapaneseDirectMapping(url, result);
    case 'required_marks':
      return generateRequiredMarksMapping(url, result);
    case 'mailform_cgi':
      return generateMailFormCGIMapping(url, result);
    case 'split_fields':
      return generateSplitFieldsMapping(url, result);
    default:
      return null;
  }
}

/**
 * Batch Mapping Generator
 * Generates mappings for multiple URLs with their detected patterns
 */
export function generateBatchMappings(
  results: Array<{ url: string; pattern: PatternResult }>
): GeneratedMapping[] {
  return results
    .map(({ url, pattern }) => generateMapping(url, pattern))
    .filter((mapping): mapping is GeneratedMapping => mapping !== null);
}

/**
 * Export mappings to SITE_MAPPINGS JSON format
 */
export function exportToSiteMappings(mappings: GeneratedMapping[]): string {
  const siteMappings: { [key: string]: any } = {};

  mappings.forEach((mapping) => {
    siteMappings[mapping.url] = {
      pattern: mapping.pattern,
      confidence: mapping.confidence,
      mapping: mapping.mapping,
      _auto_detected: mapping._auto_detected,
      _detected_at: mapping._detected_at,
      _pattern: mapping._pattern,
    };
  });

  return JSON.stringify(siteMappings, null, 2);
}
