/* eslint-disable @typescript-eslint/no-explicit-any */

export class PHISanitizer {
  /**
   * Sanitize data for logging by removing or masking PHI
   */
  static sanitizeForLogging(data: any): string {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(this.sanitizeObject(data));
    }

    return String(data);
  }

  /**
   * Sanitize strings for common PHI patterns
   */
  static sanitizeString(str: string): string {
    return (
      str
        // Phone numbers: +1-555-123-4567 -> +1-XXX-XXX-XXXX
        .replace(
          /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
          '$1XXX-XXX-XXXX',
        )
        // SSN: 123-45-6789 -> XXX-XX-XXXX
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX')
        // Email: john.doe@example.com -> j***@example.com
        .replace(
          /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
          (match, user: string, domain: string) => {
            const maskedUser = user.length > 1 ? user[0] + '*'.repeat(user.length - 1) : '*';
            return `${maskedUser}@${domain}`;
          },
        )
        // Dates: 1990-01-01 -> XXXX-XX-XX
        .replace(/\b\d{4}-\d{2}-\d{2}\b/g, 'XXXX-XX-XX')
    );
  }

  /**
   * Recursively sanitize objects
   */
  static sanitizeObject(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Skip known PHI fields entirely
      if (this.isPHIField(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if a field name indicates PHI, case insensitive
   */
  static isPHIField(fieldName: string): boolean {
    const phiFields = [
      'ssn',
      'social',
      'socialsecurity',
      'social_security',
      'social-security',
      'phone',
      'telephone',
      'mobile',
      'email',
      'emailaddress',
      'email_address',
      'email-address',
      'firstname',
      'lastname',
      'givenname',
      'familyname',
      'address',
      'street',
      'city',
      'zip',
      'postal',
      'birthdate',
      'birth',
      'dob',
      'externalid',
      'external_id',
      'medicalrecord',
      'mrn',
      'medical_record_number',
    ];

    return phiFields.some((phiField) => fieldName.toLowerCase().includes(phiField.toLowerCase()));
  }
}
