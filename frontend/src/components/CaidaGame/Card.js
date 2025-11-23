import React from 'react';
import './Card.css'; // We will create this next

const Card = ({ suit, rank, onClick, style, className }) => {
    // Helper to render symbols based on rank
    const renderSymbols = () => {
        // Figures (10, 11, 12) use SVG masks in CSS
        if (rank >= 10) {
            return (
                <div className="es-face"></div>
            );
        }

        // Numbers (1-7) use grid of symbols
        const count = rank;
        return Array.from({ length: count }).map((_, i) => (
            <div key={i} className="es-symbol"></div>
        ));
    };

    return (
        <article
            className={`es-card ${className || ''}`}
            data-palo={suit}
            data-valor={rank}
            onClick={onClick}
            style={style}
        >
            <div className="es-card__frame">
                <div className="es-card__paper">
                    <header className="es-card__head">
                        <div>
                            <div className="es-rank">{rank}</div>
                            <div className="es-suit-label">{suit}</div>
                        </div>
                        <div className="es-mini-suit"></div>
                    </header>

                    <div className="es-symbols">
                        {renderSymbols()}
                    </div>

                    <footer className="es-card__foot">
                        <div>
                            <div className="es-rank">{rank}</div>
                            <div className="es-suit-label">{suit}</div>
                        </div>
                        <div className="es-mini-suit"></div>
                    </footer>
                </div>
            </div>
        </article>
    );
};

export default Card;
