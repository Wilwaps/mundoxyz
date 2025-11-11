import React, { useState, useEffect } from 'react';
import './BingoV2Card.css';

const BingoV2Card = ({ 
  card, 
  cardNumber, 
  drawnNumbers, 
  mode, 
  onMarkNumber, 
  onCallBingo,
  canCallBingo 
}) => {
  // Initialize marked positions from card data
  const [markedPositions, setMarkedPositions] = useState(() => {
    const initialMarked = new Set();
    if (card?.marked_positions) {
      card.marked_positions.forEach(pos => {
        initialMarked.add(`${pos.row},${pos.col}`);
      });
    }
    return initialMarked;
  });
  const [highlightedNumbers, setHighlightedNumbers] = useState(new Set());

  // Sync marked positions when card changes
  useEffect(() => {
    if (card?.marked_positions) {
      const newMarked = new Set();
      card.marked_positions.forEach(pos => {
        newMarked.add(`${pos.row},${pos.col}`);
      });
      setMarkedPositions(newMarked);
    }
  }, [card?.marked_positions]);

  useEffect(() => {
    // Highlight drawn numbers
    if (card?.grid && drawnNumbers) {
      const highlighted = new Set();
      
      card.grid.forEach((row, rowIdx) => {
        row.forEach((cell, colIdx) => {
          if (cell?.value && drawnNumbers.includes(cell.value)) {
            highlighted.add(`${rowIdx},${colIdx}`);
          }
        });
      });
      
      setHighlightedNumbers(highlighted);
    }
  }, [card, drawnNumbers]);

  const handleCellClick = (row, col, value) => {
    // Can't mark empty cells or already marked cells
    if (!value || value === null) return;
    
    const posKey = `${row},${col}`;
    
    // CRITICAL: FREE space is ALWAYS marked and cannot be unmarked
    if (value === 'FREE') {
      // Do nothing - FREE is permanently marked from card creation
      return;
    }
    
    // Only allow marking if number was called
    if (drawnNumbers.includes(value)) {
      if (markedPositions.has(posKey)) {
        // Unmark
        const newMarked = new Set(markedPositions);
        newMarked.delete(posKey);
        setMarkedPositions(newMarked);
      } else {
        // Mark
        const newMarked = new Set(markedPositions);
        newMarked.add(posKey);
        setMarkedPositions(newMarked);
        onMarkNumber({ row, col });
      }
    }
  };

  const renderCell = (cell, row, col) => {
    const posKey = `${row},${col}`;
    
    // Si cell no existe o value es null/undefined, renderizar celda vacía
    if (!cell || cell.value === null || cell.value === undefined) {
      return (
        <div 
          key={posKey}
          className="bingo-cell empty"
        >
          &nbsp;
        </div>
      );
    }
    
    const value = cell.value;
    const isHighlighted = highlightedNumbers.has(posKey) || value === 'FREE';
    const isMarked = markedPositions.has(posKey);
    
    // Celda con número o FREE
    return (
      <div
        key={posKey}
        className={`bingo-cell ${isHighlighted ? 'highlighted' : ''} ${isMarked ? 'marked' : ''} ${value === 'FREE' ? 'free' : ''}`}
        onClick={() => handleCellClick(row, col, value)}
      >
        {value === 'FREE' ? 'FREE' : value}
        {isMarked && <span className="mark">✓</span>}
      </div>
    );
  };

  const renderBingoCard = () => {
    // Validación del grid
    if (!card.grid || !Array.isArray(card.grid)) {
      return <div className="error">Error: Grid no válido</div>;
    }
    
    // Modos 5x5: 75 y 90-in-5x5 usan el mismo layout
    const is5x5 = mode === '75' || mode === '90-in-5x5';
    const cardClassName = is5x5 ? 'bingo-card-75' : 'bingo-card-90';
    
    return (
      <div className={cardClassName}>
        {/* Cabecera BINGO para modos 5x5 (75 y 90-in-5x5) */}
        {is5x5 && (
          <div className="card-header-bingo">
            {['B', 'I', 'N', 'G', 'O'].map(letter => (
              <div key={letter} className="header-cell">{letter}</div>
            ))}
          </div>
        )}
        
        {/* Grid de cartón (compartido por ambos modos) */}
        <div className="card-grid">
          {card.grid.map((row, rowIdx) => (
            <div key={rowIdx} className="card-row">
              {row.map((cell, colIdx) => renderCell(cell, rowIdx, colIdx))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bingo-v2-card">
      <div className="card-header">
        <h3>Cartón #{cardNumber}</h3>
        {canCallBingo && (
          <button className="bingo-button animated" onClick={onCallBingo}>
            ¡BINGO!
          </button>
        )}
      </div>
      
      <div className="card-body">
        {renderBingoCard()}
      </div>
    </div>
  );
};

export default BingoV2Card;
