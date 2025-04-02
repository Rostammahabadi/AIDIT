/**
 * Security utilities for handling sensitive information
 */

/**
 * Simple encryption function for API keys
 * Uses a combination of base64 encoding and character substitution
 * Note: This is not military-grade encryption, but provides basic obfuscation
 * @param text The text to encrypt
 * @returns The encrypted text
 */
export const encryptApiKey = (text: string): string => {
  if (!text) return '';
  
  // First, encode to base64
  const base64 = btoa(text);
  
  // Then apply a simple character substitution
  return base64
    .split('')
    .map(char => {
      // Simple character substitution
      const code = char.charCodeAt(0);
      return String.fromCharCode(code + 1);
    })
    .join('');
};

/**
 * Decryption function for API keys
 * Reverses the encryption process
 * @param encrypted The encrypted text
 * @returns The decrypted text
 */
export const decryptApiKey = (encrypted: string): string => {
  if (!encrypted) return '';
  
  // Reverse the character substitution
  const base64 = encrypted
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      return String.fromCharCode(code - 1);
    })
    .join('');
  
  // Decode from base64
  try {
    return atob(base64);
  } catch (error) {
    console.error('Error decrypting API key:', error);
    return '';
  }
};
