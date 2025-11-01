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
  const [markedPositions, setMarkedPositions] = useState(new Set());
  const [highlightedNumbers, setHighlightedNumbers] = useState(new Set());

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
    
    // For FREE space, always allow marking
    if (value === 'FREE') {
      if (!markedPositions.has(posKey)) {
        const newMarked = new Set(markedPositions);
        newMarked.add(posKey);
        setMarkedPositions(newMarked);
        onMarkNumber({ row, col });
      }
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
    if (!cell) return null;
    
    const value = cell.value;
    const posKey = `${row},${col}`;
    const isHighlighted = highlightedNumbers.has(posKey) || value === 'FREE';
    const isMarked = markedPositions.has(posKey);
    
    // For 90-ball empty cells
    if (value === null) {
      return (
        <div 
          key={posKey}
          className="bingo-cell empty"
        />
      );
    }
    
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

  const render75BallCard = () => {
    const headers = ['B', 'I', 'N', 'G', 'O'];
    
    return (
      <div className="bingo-card-75">
        <div className="card-header">
          {headers.map(letter => (
            <div key={letter} className="header-cell">{letter}</div>
          ))}
        </div>
        <div className="card-grid">
          {card.grid?.map((row, rowIdx) => (
            <div key={rowIdx} className="card-row">
              {row.map((cell, colIdx) => renderCell(cell, rowIdx, colIdx))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const render90BallCard = () => {
    return (
      <div className="bingo-card-90">
        <div className="card-grid">
          {card.grid?.map((row, rowIdx) => (
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
        {mode === '75' ? render75BallCard() : render90BallCard()}
      </div>
    </div>
  );
};

export default BingoV2Card;
