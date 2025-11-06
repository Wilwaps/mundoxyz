/**
 * Lista completa de bancos venezolanos
 * Códigos oficiales para pago móvil y transferencias
 */

export const VENEZUELA_BANKS = [
  { code: '0102', name: 'Banco de Venezuela, S.A.C.A.' },
  { code: '0104', name: 'Banco Venezolano de Crédito, S.A.' },
  { code: '0105', name: 'Banco Mercantil, C.A.' },
  { code: '0108', name: 'BBVA Provincial, S.A.' },
  { code: '0114', name: 'Bancaribe C.A.' },
  { code: '0115', name: 'Banco Exterior, C.A.' },
  { code: '0128', name: 'Banco Caroní, C.A.' },
  { code: '0134', name: 'Banesco Banco Universal, S.A.C.A.' },
  { code: '0137', name: 'Banco Sofitasa, Banco Universal, C.A.' },
  { code: '0138', name: 'Banco Plaza, C.A.' },
  { code: '0156', name: '100% Banco, Banco Comercial, C.A.' },
  { code: '0157', name: 'Del Sur, Banco Universal, C.A.' },
  { code: '0175', name: 'Banco Bicentenario, Banco Universal, C.A.' },
  { code: '0168', name: 'Bancrecer, S.A.' },
  { code: '0169', name: 'R4, Banco Microfinanciero, C.A.' },
  { code: '0172', name: 'Bancamiga, Banco Microfinanciero, C.A.' },
  { code: '0001', name: 'Banco Central de Venezuela' },
  { code: '0003', name: 'Banco Industrial de Venezuela' },
  { code: '0171', name: 'Banco Activo, Banco Comercial, C.A.' },
  { code: '0173', name: 'Banco Internacional de Desarrollo, C.A.' },
  { code: '0174', name: 'Banplus Banco Comercial, C.A.' },
  { code: '0190', name: 'Citibank, N.A.' },
  { code: '0191', name: 'Banco Nacional de Crédito' }
];

/**
 * Obtener nombre completo del banco por código
 * @param {string} code - Código del banco (ej: '0102')
 * @returns {string} - Nombre formateado (ej: '0102 - Banco de Venezuela')
 */
export const getBankName = (code) => {
  const bank = VENEZUELA_BANKS.find(b => b.code === code);
  return bank ? `${bank.code} - ${bank.name}` : code;
};

/**
 * Obtener solo el nombre del banco sin código
 * @param {string} code - Código del banco
 * @returns {string} - Nombre del banco
 */
export const getBankNameOnly = (code) => {
  const bank = VENEZUELA_BANKS.find(b => b.code === code);
  return bank ? bank.name : 'Banco desconocido';
};

/**
 * Validar si un código de banco es válido
 * @param {string} code - Código a validar
 * @returns {boolean}
 */
export const isValidBankCode = (code) => {
  return VENEZUELA_BANKS.some(b => b.code === code);
};

/**
 * Ordenar bancos por nombre
 * @returns {Array} - Bancos ordenados alfabéticamente
 */
export const getBanksSortedByName = () => {
  return [...VENEZUELA_BANKS].sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Obtener bancos más usados (top 10)
 * @returns {Array}
 */
export const getPopularBanks = () => {
  const popular = ['0134', '0102', '0105', '0108', '0114', '0191', '0175', '0104', '0174', '0172'];
  return popular.map(code => VENEZUELA_BANKS.find(b => b.code === code)).filter(Boolean);
};
