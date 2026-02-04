/**
 * Pattern Detection Utilities for Form Analysis
 * Re-implements the 5 pattern detectors from content.js for server-side use
 */

export interface FormField {
  name: string;
  type: string;
  required: boolean;
  label?: string;
  placeholder?: string;
  value?: string;
}

export interface PatternResult {
  pattern: string;
  confidence: number;
  mapping: FieldMapping;
}

export interface FieldMapping {
  companyName?: string;
  personName?: string;
  email?: string;
  phone?: string;
  inquiry?: string;
  url?: string;
  [key: string]: string | undefined;
}

export interface SiteMapping {
  url: string;
  pattern: string;
  confidence: number;
  mapping: FieldMapping;
  detectedAt: string;
}

/**
 * 1. Contact Form 7 Pattern Detector
 * Detects WordPress Contact Form 7 patterns (your-name, your-email, etc.)
 */
export function detectWordPressCF7(fields: FormField[]): PatternResult | null {
  const cf7Patterns = {
    'your-name': 'personName',
    'your-email': 'email',
    'your-subject': 'inquiry',
    'your-message': 'inquiry',
    'your-company': 'companyName',
    'your-tel': 'phone',
  };

  let matchCount = 0;
  const mapping: FieldMapping = {};

  fields.forEach(field => {
    const fieldName = field.name.toLowerCase();
    for (const [pattern, mappingKey] of Object.entries(cf7Patterns)) {
      if (fieldName.includes(pattern)) {
        matchCount++;
        mapping[mappingKey] = field.name;
      }
    }
  });

  if (matchCount >= 2) {
    return {
      pattern: 'wordpress_cf7',
      confidence: Math.min(matchCount / fields.length, 1),
      mapping,
    };
  }

  return null;
}

/**
 * 2. Japanese Direct Pattern Detector
 * Detects forms with direct Japanese field names (会社名, お名前, etc.)
 */
export function detectJapaneseDirect(fields: FormField[]): PatternResult | null {
  const japanesePatterns = {
    '会社名': 'companyName',
    '企業名': 'companyName',
    '社名': 'companyName',
    'お名前': 'personName',
    '名前': 'personName',
    '氏名': 'personName',
    'メール': 'email',
    'メールアドレス': 'email',
    '電話': 'phone',
    '電話番号': 'phone',
    'お問い合わせ': 'inquiry',
    '問い合わせ内容': 'inquiry',
    'ご質問': 'inquiry',
  };

  let matchCount = 0;
  const mapping: FieldMapping = {};

  fields.forEach(field => {
    const fieldName = field.name;
    const fieldLabel = field.label || '';
    const fieldPlaceholder = field.placeholder || '';

    for (const [pattern, mappingKey] of Object.entries(japanesePatterns)) {
      if (
        fieldName.includes(pattern) ||
        fieldLabel.includes(pattern) ||
        fieldPlaceholder.includes(pattern)
      ) {
        matchCount++;
        mapping[mappingKey] = field.name;
      }
    }
  });

  if (matchCount >= 2) {
    return {
      pattern: 'japanese_direct',
      confidence: Math.min(matchCount / fields.length, 1),
      mapping,
    };
  }

  return null;
}

/**
 * 3. Required Marks Pattern Detector
 * Detects forms with (必須) or similar required markers in labels
 */
export function detectRequiredMarks(fields: FormField[]): PatternResult | null {
  const requiredMarkers = ['必須', '※', '*'];
  const japaneseFieldPatterns = {
    '会社': 'companyName',
    '企業': 'companyName',
    '社名': 'companyName',
    '名前': 'personName',
    '氏名': 'personName',
    'メール': 'email',
    '電話': 'phone',
    'お問い合わせ': 'inquiry',
    '問い合わせ': 'inquiry',
  };

  let matchCount = 0;
  const mapping: FieldMapping = {};

  fields.forEach(field => {
    const fieldLabel = field.label || '';

    // Check if label contains required markers
    const hasRequiredMarker = requiredMarkers.some(marker =>
      fieldLabel.includes(marker)
    );

    if (hasRequiredMarker) {
      // Try to match the label to a field type
      for (const [pattern, mappingKey] of Object.entries(japaneseFieldPatterns)) {
        if (fieldLabel.includes(pattern)) {
          matchCount++;
          mapping[mappingKey] = field.name;
          break;
        }
      }
    }
  });

  if (matchCount >= 2) {
    return {
      pattern: 'required_marks',
      confidence: Math.min(matchCount / fields.length, 1),
      mapping,
    };
  }

  return null;
}

/**
 * 4. MailForm CGI Pattern Detector
 * Detects MailForm CGI patterns (F1, F2, Email1, Email2, etc.)
 */
export function detectMailFormCGI(fields: FormField[]): PatternResult | null {
  const mapping: FieldMapping = {};
  let fFieldCount = 0;
  let emailFieldCount = 0;

  fields.forEach(field => {
    const fieldName = field.name;

    // Check for F[digit] pattern
    if (/^F\d+$/.test(fieldName)) {
      fFieldCount++;
      // Try to infer the field type from label or placeholder
      const label = (field.label || '').toLowerCase();
      const placeholder = (field.placeholder || '').toLowerCase();

      if (label.includes('会社') || label.includes('企業') || label.includes('社名')) {
        mapping.companyName = fieldName;
      } else if (label.includes('名前') || label.includes('氏名')) {
        mapping.personName = fieldName;
      } else if (label.includes('電話')) {
        mapping.phone = fieldName;
      } else if (label.includes('問い合わせ') || label.includes('質問')) {
        mapping.inquiry = fieldName;
      }
    }

    // Check for Email[digit] pattern
    if (/^Email\d+$/i.test(fieldName)) {
      emailFieldCount++;
      mapping.email = fieldName;
    }
  });

  const totalMatches = fFieldCount + emailFieldCount;
  if (totalMatches >= 3) {
    return {
      pattern: 'mailform_cgi',
      confidence: Math.min(totalMatches / fields.length, 1),
      mapping,
    };
  }

  return null;
}

/**
 * 5. Split Fields Pattern Detector
 * Detects forms with numbered sequential fields (name1, name2, email1, email2, etc.)
 */
export function detectSplitFields(fields: FormField[]): PatternResult | null {
  const fieldGroups: { [key: string]: string[] } = {};

  fields.forEach(field => {
    const fieldName = field.name;
    // Match patterns like "name1", "name2", "email_1", "email_2"
    const match = fieldName.match(/^(.+?)[_-]?(\d+)$/);

    if (match) {
      const baseName = match[1];
      if (!fieldGroups[baseName]) {
        fieldGroups[baseName] = [];
      }
      fieldGroups[baseName].push(fieldName);
    }
  });

  const mapping: FieldMapping = {};
  let groupCount = 0;

  // Check for groups with multiple sequential fields
  for (const [baseName, group] of Object.entries(fieldGroups)) {
    if (group.length >= 2) {
      groupCount++;
      const lowerBaseName = baseName.toLowerCase();

      if (lowerBaseName.includes('name') || lowerBaseName.includes('名前')) {
        mapping.personName = group[0];
      } else if (lowerBaseName.includes('email') || lowerBaseName.includes('メール')) {
        mapping.email = group[0];
      } else if (lowerBaseName.includes('company') || lowerBaseName.includes('会社')) {
        mapping.companyName = group[0];
      } else if (lowerBaseName.includes('tel') || lowerBaseName.includes('phone') || lowerBaseName.includes('電話')) {
        mapping.phone = group[0];
      }
    }
  }

  if (groupCount >= 2) {
    return {
      pattern: 'split_fields',
      confidence: Math.min(groupCount / Object.keys(fieldGroups).length, 1),
      mapping,
    };
  }

  return null;
}

/**
 * Main Pattern Detection Function
 * Runs all 5 pattern detectors and returns the best match
 */
export function detectPattern(fields: FormField[]): PatternResult | null {
  if (!fields || fields.length === 0) {
    return null;
  }

  const detectors = [
    detectWordPressCF7,
    detectJapaneseDirect,
    detectRequiredMarks,
    detectMailFormCGI,
    detectSplitFields,
  ];

  const results: PatternResult[] = [];

  for (const detector of detectors) {
    const result = detector(fields);
    if (result) {
      results.push(result);
    }
  }

  if (results.length === 0) {
    return null;
  }

  // Return the result with highest confidence
  return results.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );
}
