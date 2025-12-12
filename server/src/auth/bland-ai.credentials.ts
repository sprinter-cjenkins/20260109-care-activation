export function getBlandAIConfig() {
  const config = {
    development: {
      blandAPIKey: process.env.BLAND_AI_DEVELOPMENT_API_KEY,
      encryptedKey: process.env.BLAND_AI_DEVELOPMENT_TWILIO_ENCRYPTED_KEY,
      fromNumber: process.env.BLAND_AI_DEVELOPMENT_FROM_NUMBER,
      blandAPIURL: 'https://api.bland.ai/v1',
    },
    production: {
      blandAPIKey: process.env.BLAND_AI_API_KEY,
      encryptedKey: process.env.BLAND_AI_TWILIO_ENCRYPTED_KEY,
      fromNumber: process.env.BLAND_AI_FROM_NUMBER,
      blandAPIURL: 'https://api.bland.ai/v1',
    },
  };

  return process.env.NODE_ENV === 'development' ? config.development : config.production;
}
