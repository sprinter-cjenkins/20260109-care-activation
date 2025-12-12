import { PHISanitizer } from './phi-sanitizer';

describe('PHISanitizer', () => {
  describe('sanitizeString', () => {
    it('should mask phone numbers', () => {
      expect(PHISanitizer.sanitizeString('Call me at +1-555-123-4567')).toBe(
        'Call me at +1-XXX-XXX-XXXX',
      );
    });

    it('should mask emails', () => {
      expect(PHISanitizer.sanitizeString('Contact john.doe@example.com')).toBe(
        'Contact j*******@example.com',
      );
    });

    it('should mask ssn', () => {
      expect(PHISanitizer.sanitizeString('Patient SSN 123-45-6789')).toBe(
        'Patient SSN XXX-XX-XXXX',
      );
    });

    it('should mask dates', () => {
      expect(PHISanitizer.sanitizeString('Patient birth date 1990-01-01')).toBe(
        'Patient birth date XXXX-XX-XX',
      );
    });
  });

  describe('isPHIField', () => {
    it('should identify PHI fields', () => {
      expect(PHISanitizer.isPHIField('emailAddress')).toBe(true);
      expect(PHISanitizer.isPHIField('phoneNumber')).toBe(true);
      expect(PHISanitizer.isPHIField('ssn')).toBe(true);
      expect(PHISanitizer.isPHIField('birthDate')).toBe(true);
    });

    it('should not identify non-PHI fields', () => {
      expect(PHISanitizer.isPHIField('status')).toBe(false);
      expect(PHISanitizer.isPHIField('createdAt')).toBe(false);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize objects', () => {
      expect(
        PHISanitizer.sanitizeObject({
          emailAddress: 'john.doe@example.com',
          patientData: {
            givenName: 'John',
            familyName: 'Doe',
            wrongField: '+1234567890',
            phoneNumber: '+1234567890',
            ssn: '123-45-6789',
          },
          partnerOrganization: 'Elevance Health',
          birthDate: '1990-01-01',
        }),
      ).toStrictEqual({
        emailAddress: '[REDACTED]',
        patientData: {
          givenName: '[REDACTED]',
          familyName: '[REDACTED]',
          wrongField: '+XXX-XXX-XXXX',
          phoneNumber: '[REDACTED]',
          ssn: '[REDACTED]',
        },
        partnerOrganization: 'Elevance Health',
        birthDate: '[REDACTED]',
      });
    });
  });
});
