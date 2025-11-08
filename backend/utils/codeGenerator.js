/**
 * Generador de códigos únicos
 */

/**
 * Genera un código alfanumérico aleatorio
 * @param {number} length - Longitud del código
 * @param {boolean} numbersOnly - Si debe contener solo números
 * @returns {string} Código generado
 */
function generateCode(length = 6, numbersOnly = true) {
  const numbers = '0123456789';
  const alphanumeric = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  const charset = numbersOnly ? numbers : alphanumeric;
  let code = '';
  
  for (let i = 0; i < length; i++) {
    code += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return code;
}

/**
 * Genera un código de referencia para pagos
 * @returns {string} Código de referencia
 */
function generatePaymentReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = generateCode(4, false);
  return `PAY-${timestamp}-${random}`;
}

/**
 * Genera un ID único basado en timestamp
 * @returns {string} ID único
 */
function generateUniqueId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `${timestamp}${random}`;
}

module.exports = {
  generateCode,
  generatePaymentReference,
  generateUniqueId
};
