/**
 * HTML Parser Utilities
 * Extract contact links and form fields from HTML content
 */

import { FormField } from './patternDetector';

/**
 * Find contact link in HTML content
 * Looks for お問い合わせ/contact links
 * @param html - HTML content to search
 * @param baseUrl - Base URL for resolving relative links
 * @returns Absolute URL of contact page, or null if not found
 */
export function findContactLink(html: string, baseUrl: string): string | null {
  // Patterns to match contact links (Japanese and English)
  const contactPatterns = [
    /href=["']([^"']*(?:contact|お問い合わせ|問い合わせ)[^"']*)["']/gi,
    /href=["']([^"']*inquiry[^"']*)["']/gi,
  ];

  for (const pattern of contactPatterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      const href = match[1];

      // Convert relative URL to absolute
      try {
        const url = new URL(href, baseUrl);
        return url.href;
      } catch (e) {
        // Invalid URL, continue searching
        continue;
      }
    }
  }

  return null;
}

/**
 * Extract form fields from HTML content
 * Extracts input, textarea, and select elements
 * @param html - HTML content to parse
 * @returns Array of form fields with their attributes
 */
export function extractFormFields(html: string): FormField[] {
  const fields: FormField[] = [];

  // Extract input fields
  const inputRegex = /<input([^>]*)>/gi;
  let match;

  while ((match = inputRegex.exec(html)) !== null) {
    const attributes = match[1];
    const field = parseFieldAttributes(attributes, 'input');
    if (field && field.name) {
      fields.push(field);
    }
  }

  // Extract textarea fields
  const textareaRegex = /<textarea([^>]*)>/gi;
  while ((match = textareaRegex.exec(html)) !== null) {
    const attributes = match[1];
    const field = parseFieldAttributes(attributes, 'textarea');
    if (field && field.name) {
      fields.push(field);
    }
  }

  // Extract select fields
  const selectRegex = /<select([^>]*)>/gi;
  while ((match = selectRegex.exec(html)) !== null) {
    const attributes = match[1];
    const field = parseFieldAttributes(attributes, 'select');
    if (field && field.name) {
      fields.push(field);
    }
  }

  return fields;
}

/**
 * Parse attributes from field HTML to create FormField object
 * @param attributes - HTML attributes string
 * @param defaultType - Default field type
 * @returns FormField object or null if no name attribute
 */
function parseFieldAttributes(attributes: string, defaultType: string): FormField | null {
  const nameMatch = attributes.match(/name=["']([^"']*)["']/i);
  if (!nameMatch) {
    return null;
  }

  const name = nameMatch[1];

  // Extract type attribute (for input fields)
  const typeMatch = attributes.match(/type=["']([^"']*)["']/i);
  const type = typeMatch ? typeMatch[1] : defaultType;

  // Check if required
  const required = /required/i.test(attributes);

  // Extract placeholder
  const placeholderMatch = attributes.match(/placeholder=["']([^"']*)["']/i);
  const placeholder = placeholderMatch ? placeholderMatch[1] : undefined;

  // Extract value
  const valueMatch = attributes.match(/value=["']([^"']*)["']/i);
  const value = valueMatch ? valueMatch[1] : undefined;

  // Try to find associated label (this is a simplified approach)
  // In real DOM parsing, we would look for <label for="fieldId">
  // Here we just return undefined for label as it requires more context
  const label = undefined;

  return {
    name,
    type,
    required,
    label,
    placeholder,
    value,
  };
}
