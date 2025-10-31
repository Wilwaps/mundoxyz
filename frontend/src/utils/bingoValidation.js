/**
 * Utilidades de validación de patrones ganadores de Bingo
 * Detecta si un cartón tiene un patrón ganador válido
 */

/**
 * Verificar si un número está marcado
 */
const isMarked = (num, markedNumbers) => {
  if (num === 'FREE' || num === null) return true;
  if (typeof num === 'object' && num !== null) {
    num = num.value;
  }
  return markedNumbers.includes(num) || markedNumbers.includes('FREE');
};

/**
 * Extraer valor de número (objeto o primitivo)
 */
const getNumberValue = (cellData) => {
  if (typeof cellData === 'object' && cellData !== null) {
    return cellData.value;
  }
  return cellData;
};

/**
 * Validar patrón de victoria para modo 75 números (5x5)
 */
export const checkVictoryPattern = (grid, markedNumbers, victoryMode) => {
  if (!grid || !Array.isArray(grid) || grid.length === 0) {
    return false;
  }

  // Normalizar victory mode
  const mode = (victoryMode || '').toLowerCase();

  try {
    switch (mode) {
      case 'linea':
      case 'línea':
      case 'line':
        return checkLinePattern(grid, markedNumbers);
      
      case 'esquinas':
      case 'corners':
        return checkCornersPattern(grid, markedNumbers);
      
      case 'completo':
      case 'full':
      case 'blackout':
        return checkFullPattern(grid, markedNumbers);
      
      default:
        console.warn('Modo de victoria desconocido:', victoryMode);
        return false;
    }
  } catch (error) {
    console.error('Error validando patrón:', error);
    return false;
  }
};

/**
 * Validar patrón de LÍNEA (horizontal, vertical o diagonal)
 */
const checkLinePattern = (grid, markedNumbers) => {
  // Verificar filas (horizontal)
  for (let row = 0; row < 5; row++) {
    let rowComplete = true;
    for (let col = 0; col < 5; col++) {
      const cell = grid[col][row];
      const num = getNumberValue(cell);
      if (!isMarked(num, markedNumbers)) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) return true;
  }
  
  // Verificar columnas (vertical)
  for (let col = 0; col < 5; col++) {
    let colComplete = true;
    for (let row = 0; row < 5; row++) {
      const cell = grid[col][row];
      const num = getNumberValue(cell);
      if (!isMarked(num, markedNumbers)) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) return true;
  }
  
  // Verificar diagonal principal (top-left a bottom-right)
  let diag1Complete = true;
  for (let i = 0; i < 5; i++) {
    const cell = grid[i][i];
    const num = getNumberValue(cell);
    if (!isMarked(num, markedNumbers)) {
      diag1Complete = false;
      break;
    }
  }
  if (diag1Complete) return true;
  
  // Verificar diagonal secundaria (top-right a bottom-left)
  let diag2Complete = true;
  for (let i = 0; i < 5; i++) {
    const cell = grid[i][4 - i];
    const num = getNumberValue(cell);
    if (!isMarked(num, markedNumbers)) {
      diag2Complete = false;
      break;
    }
  }
  if (diag2Complete) return true;
  
  return false;
};

/**
 * Validar patrón de ESQUINAS (4 corners)
 */
const checkCornersPattern = (grid, markedNumbers) => {
  const corners = [
    grid[0][0],  // Top-left
    grid[4][0],  // Top-right
    grid[0][4],  // Bottom-left
    grid[4][4]   // Bottom-right
  ];
  
  for (const cell of corners) {
    const num = getNumberValue(cell);
    if (!isMarked(num, markedNumbers)) {
      return false;
    }
  }
  
  return true;
};

/**
 * Validar patrón COMPLETO (todo el cartón)
 */
const checkFullPattern = (grid, markedNumbers) => {
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      const cell = grid[col][row];
      const num = getNumberValue(cell);
      if (!isMarked(num, markedNumbers)) {
        return false;
      }
    }
  }
  
  return true;
};

/**
 * Obtener descripción del patrón ganador detectado
 */
export const getWinningPatternDescription = (grid, markedNumbers) => {
  if (checkLinePattern(grid, markedNumbers)) {
    return 'Línea completa';
  }
  if (checkCornersPattern(grid, markedNumbers)) {
    return '4 Esquinas';
  }
  if (checkFullPattern(grid, markedNumbers)) {
    return 'Cartón completo';
  }
  return null;
};
