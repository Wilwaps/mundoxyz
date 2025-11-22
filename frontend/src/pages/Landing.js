import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useNavigate } from 'react-router-dom';
import { 
  Gamepad2, Users, TrendingUp, Shield, Zap, 
  Flame, Coins, Trophy, ArrowRight, CheckCircle,
  BarChart3, Target, Sparkles, Gift, MessageCircle
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [bingoCardCount, setBingoCardCount] = useState(4);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    fetchPublicStats();
    
    // Actualizar stats cada 600 segundos (10 minutos)
    const interval = setInterval(fetchPublicStats, 600000);
    return () => clearInterval(interval);
  }, []);

  const fetchPublicStats = async () => {
    try {
      const response = await axios.get('/api/public/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Formato de números con animación
  const AnimatedNumber = ({ value, suffix = '', decimals = 0 }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      // Normalizar valores nulos o vacíos a 0
      if (value === null || value === undefined || value === '') {
        setDisplayValue(0);
        return;
      }

      const numValue = typeof value === 'number' ? value : parseFloat(value);

      // Proteger contra NaN o infinitos
      if (!Number.isFinite(numValue)) {
        setDisplayValue(0);
        return;
      }

      const duration = 2000;
      const steps = 60;
      const increment = numValue / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;

        // Manejar tanto incrementos positivos como negativos de forma segura
        if ((increment >= 0 && current >= numValue) || (increment < 0 && current <= numValue)) {
          setDisplayValue(numValue);
          clearInterval(timer);
        } else {
          setDisplayValue(current);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }, [value]);

    const safeValue = Number.isFinite(displayValue) ? displayValue : 0;

    return (
      <span>
        {safeValue.toLocaleString('es-ES', { 
          maximumFractionDigits: decimals,
          minimumFractionDigits: decimals 
        })}
        {suffix}
      </span>
    );
  };

  // Sección animada al hacer scroll
  const FadeInSection = ({ children, delay = 0 }) => {
    const controls = useAnimation();
    const [ref, inView] = useInView({
      triggerOnce: true,
      threshold: 0.1,
    });

    useEffect(() => {
      if (inView) {
        controls.start('visible');
      }
    }, [controls, inView]);

    return (
      <motion.div
        ref={ref}
        animate={controls}
        initial="hidden"
        transition={{ duration: 0.6, delay }}
        variants={{
          visible: { opacity: 1, y: 0 },
          hidden: { opacity: 0, y: 50 }
        }}
      >
        {children}
      </motion.div>
    );
  };

  const handlePlayBingo = () => {
    if (user) {
      navigate('/bingo');
    } else {
      navigate('/register?next=/bingo');
    }
  };

  const handleGenerateBingoPdf = async () => {
    if (generatingPdf) return;
    let count = parseInt(bingoCardCount, 10);
    if (!Number.isFinite(count) || count <= 0) {
      count = 1;
    }
    if (count > 40) {
      count = 40;
    }
    setBingoCardCount(count);
    setGeneratingPdf(true);
    try {
      const cards = generateMultipleBingo75Cards(count);
      const payload = {
        createdAt: Date.now(),
        mode: 75,
        count,
        cards
      };
      try {
        localStorage.setItem('bingoPrintCards', JSON.stringify(payload));
      } catch (_) {}
      await createBingoPdfFromCards(cards);
      try {
        localStorage.removeItem('bingoPrintCards');
      } catch (_) {}
    } catch (error) {
      console.error('Error generating bingo PDF', error);
      alert('Error al generar el PDF de cartones. Intenta nuevamente.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="landing-page">
      {/* HEADER */}
      <header className="landing-header">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <Gamepad2 size={32} />
              <span>MUNDOXYZ</span>
            </div>
            <nav className="header-nav">
              <button onClick={() => navigate('/login')} className="btn-login">
                Iniciar Sesión
              </button>
              <button onClick={() => navigate('/register')} className="btn-register">
                Registrarse Gratis
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="hero-section">
        <div className="hero-bg-animated"></div>
        <div className="container">
          <motion.div 
            className="hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div 
              className="hero-badge"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles size={16} />
              <span>MiniApp de Juegos en Telegram</span>
            </motion.div>

            <h1 className="hero-title">
              Juega, Gana y Crece en una
              <span className="gradient-text"> Economía Digital Real</span>
            </h1>

            <p className="hero-description">
              MiniApp de Telegram donde cada partida cuenta.
              Descubre bingo, rifas públicas y rifas de empresa con coins y fires, y convierte el juego en una economía viva para tu comunidad.
            </p>

            <div className="hero-features">
              <div className="hero-feature">
                <CheckCircle size={20} />
                <span>Conecta con Telegram en 1 click</span>
              </div>
              <div className="hero-feature">
                <CheckCircle size={20} />
                <span>Economía dual: Monedas y Fuegos</span>
              </div>
              <div className="hero-feature">
                <CheckCircle size={20} />
                <span>100% transparente y auditable</span>
              </div>
            </div>

            <div className="hero-cta">
              <button 
                onClick={() => navigate('/register')} 
                className="btn-cta-primary"
              >
                <span>Empezar Gratis</span>
                <ArrowRight size={20} />
              </button>
              <button 
                onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}
                className="btn-cta-secondary"
              >
                Ver Cómo Funciona
              </button>
            </div>
          </motion.div>

          {/* Stats Preview */}
          {!loading && stats && (
            <motion.div 
              className="hero-stats"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="stat-card">
                <Users className="stat-icon" />
                <div className="stat-value">
                  <AnimatedNumber value={stats.users.active7Days} />
                </div>
                <div className="stat-label">Jugadores Activos</div>
              </div>
              <div className="stat-card">
                <Trophy className="stat-icon" />
                <div className="stat-value">
                  <AnimatedNumber value={stats.games.playedLast30Days.total} />
                </div>
                <div className="stat-label">Juegos Este Mes</div>
              </div>
              <div className="stat-card">
                <Flame className="stat-icon stat-icon-fire" />
                <div className="stat-value">
                  <AnimatedNumber value={stats.economy.totalFiresCirculation} decimals={0} />
                </div>
                <div className="stat-label">Fuegos en Circulación</div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ECONOMÍA TRANSPARENTE */}
      <FadeInSection>
        <section className="economy-section">
          <div className="container">
            <div className="section-header">
              <BarChart3 size={32} className="section-icon" />
              <h2>Economía 100% Transparente</h2>
              <p>Todo es público, todo es justo. Consulta las estadísticas en tiempo real.</p>
            </div>

            {!loading && stats && (
              <div className="economy-grid">
                <div className="economy-card economy-card-primary">
                  <div className="economy-card-icon">
                    <Flame size={40} />
                  </div>
                  <div className="economy-card-content">
                    <div className="economy-value">
                      <AnimatedNumber 
                        value={stats.economy.totalFiresCirculation} 
                        suffix=" 🔥"
                        decimals={2}
                      />
                    </div>
                    <div className="economy-label">Total Fuegos en Circulación</div>
                    <div className="economy-desc">Supply controlado y auditable</div>
                  </div>
                </div>

                <div className="economy-card economy-card-secondary">
                  <div className="economy-card-icon">
                    <Coins size={40} />
                  </div>
                  <div className="economy-card-content">
                    <div className="economy-value">
                      <AnimatedNumber 
                        value={stats.economy.totalCoinsCirculation} 
                        suffix=" 💰"
                        decimals={0}
                      />
                    </div>
                    <div className="economy-label">Total Monedas Activas</div>
                    <div className="economy-desc">Para todos los juegos</div>
                  </div>
                </div>

                <div className="economy-card">
                  <div className="economy-card-icon">
                    <Users size={40} />
                  </div>
                  <div className="economy-card-content">
                    <div className="economy-value">
                      <AnimatedNumber value={stats.users.total} />
                    </div>
                    <div className="economy-label">Usuarios Registrados</div>
                    <div className="economy-desc">Comunidad en crecimiento</div>
                  </div>
                </div>

                <div className="economy-card">
                  <div className="economy-card-icon">
                    <Trophy size={40} />
                  </div>
                  <div className="economy-card-content">
                    <div className="economy-value">
                      <AnimatedNumber 
                        value={stats.prizes.distributedLast30Days} 
                        suffix=" 🔥"
                        decimals={0}
                      />
                    </div>
                    <div className="economy-label">Premios Este Mes</div>
                    <div className="economy-desc">Distribuidos entre ganadores</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </FadeInSection>

      {/* JUEGOS DESTACADOS */}
      <FadeInSection>
        <section className="games-section">
          <div className="container">
            <div className="section-header">
              <Target size={32} className="section-icon" />
              <h2>Tres Formas de Divertirte</h2>
              <p>Elige tu juego favorito y comienza a ganar ahora mismo.</p>
            </div>

            <div className="games-grid">
              {/* Bingo V2 */}
              <motion.div 
                className="game-card"
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
              >
                <div className="game-card-header game-header-bingo">
                  <div className="game-icon">🎯</div>
                  <h3>Bingo en Tiempo Real</h3>
                </div>
                <div className="game-card-body">
                  <p className="game-description">
                    Partidas emocionantes con hasta 10 cartones. Chat con jugadores, 
                    premios instantáneos y dos modos: 75 y 90 bolas.
                  </p>
                  <ul className="game-features">
                    <li><CheckCircle size={16} /> Hasta 10 cartones por partida</li>
                    <li><CheckCircle size={16} /> Chat en tiempo real</li>
                    <li><CheckCircle size={16} /> Premios automáticos 70/20/10</li>
                    <li><CheckCircle size={16} /> Auto-canto inteligente para que no pierdas ningún premio</li>
                  </ul>
                  {stats && (
                    <div className="game-stat">
                      <Zap size={16} />
                      <span>{stats.games.activeNow.bingo} partidas activas ahora</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Rifas */}
              <motion.div 
                className="game-card game-card-featured"
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
              >
                <div className="featured-badge">
                  <Sparkles size={14} />
                  <span>Popular</span>
                </div>
                <div className="game-card-header game-header-raffle">
                  <div className="game-icon">🎁</div>
                  <h3>Rifas para Comunidades y Empresas</h3>
                </div>
                <div className="game-card-body">
                  <p className="game-description">
                    Organiza rifas públicas para tu comunidad o rifas de empresa para tus clientes. Entrega premios en fires, coins 
                    o recompensas físicas/digitales con un sistema 100% justo y auditable.
                  </p>
                  <ul className="game-features">
                    <li><CheckCircle size={16} /> Crea rifas públicas y rifas de empresa</li>
                    <li><CheckCircle size={16} /> Lanza campañas y sorteos para tu comunidad o clientes</li>
                    <li><CheckCircle size={16} /> Compra números con coins o fires (según la rifa)</li>
                    <li><CheckCircle size={16} /> Premios físicos o digitales con sistema transparente</li>
                  </ul>
                  {stats && (
                    <div className="game-stat">
                      <TrendingUp size={16} />
                      <span>{stats.games.activeNow.raffles} rifas disponibles</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* TicTacToe */}
              <motion.div 
                className="game-card"
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
              >
                <div className="game-card-header game-header-tictactoe">
                  <div className="game-icon">⚡</div>
                  <h3>Duelos Rápidos</h3>
                </div>
                <div className="game-card-body">
                  <p className="game-description">
                    Desafía a cualquier jugador en partidas rápidas. Sistema de 
                    revanchas, puntuación acumulada y recompensas por victoria.
                  </p>
                  <ul className="game-features">
                    <li><CheckCircle size={16} /> Partidas de 2-5 minutos</li>
                    <li><CheckCircle size={16} /> Sistema de revanchas</li>
                    <li><CheckCircle size={16} /> Modo coins o fires</li>
                    <li><CheckCircle size={16} /> Gana recompensas dentro de la economía de la app</li>
                  </ul>
                  {stats && (
                    <div className="game-stat">
                      <Zap size={16} />
                      <span>{stats.games.activeNow.tictactoe} duelos en curso</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <section className="bingo-print-section">
          <div className="container">
            <div className="section-header">
              <Target size={32} className="section-icon" />
              <h2>Saca tus cartones o juega aquí</h2>
              <p>Genera cartones de bingo 75 bolas para imprimir o entra directo al lobby de bingo.</p>
            </div>
            <div className="bingo-print-content">
              <div className="bingo-print-generator">
                <h3>Cartones para imprimir</h3>
                <p>Elige cuántos cartones quieres (máximo 40). Se crearán en un PDF con 4 cartones por hoja carta, listo para imprimir.</p>
                <div className="bingo-print-input-row">
                  <label htmlFor="bingo-card-count">Cantidad de cartones</label>
                  <input
                    id="bingo-card-count"
                    type="number"
                    min="1"
                    max="40"
                    value={bingoCardCount}
                    onChange={(e) => setBingoCardCount(e.target.value)}
                  />
                </div>
                <button
                  className="bingo-print-button"
                  type="button"
                  disabled={generatingPdf}
                  onClick={handleGenerateBingoPdf}
                >
                  {generatingPdf ? 'Generando PDF...' : 'Sacar cartones para imprimir'}
                </button>
              </div>
              <div className="bingo-play-cta">
                <h3>Juega bingo en vivo</h3>
                <p>Si prefieres jugar en línea, entra al lobby de bingo y participa con la comunidad.</p>
                <button
                  className="bingo-play-button"
                  type="button"
                  onClick={handlePlayBingo}
                >
                  Ir al lobby de bingo
                </button>
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* ECONOMÍA DUAL */}
      <FadeInSection>
        <section className="dual-economy-section">
          <div className="container">
            <div className="section-header">
              <Gift size={32} className="section-icon" />
              <h2>Dos Monedas, Infinitas Posibilidades</h2>
              <p>Una economía dual diseñada para que todos ganen.</p>
            </div>

            <div className="currency-comparison">
              <div className="currency-card currency-card-coins">
                <div className="currency-header">
                  <Coins size={48} />
                  <h3>💰 COINS</h3>
                  <span className="currency-type">Moneda Suave</span>
                </div>
                <div className="currency-features">
                  <div className="currency-feature">
                    <CheckCircle size={18} />
                    <span>Gana jugando cualquier juego</span>
                  </div>
                  <div className="currency-feature">
                    <CheckCircle size={18} />
                    <span>Accede a todas las partidas</span>
                  </div>
                  <div className="currency-feature">
                    <CheckCircle size={18} />
                    <span>Intercambia con amigos</span>
                  </div>
                  <div className="currency-feature">
                    <CheckCircle size={18} />
                    <span>Úsalas en rifas, bingo y duelos</span>
                  </div>
                </div>
                <div className="currency-desc">
                  Perfect para empezar y jugar todos los días
                </div>
              </div>

              <div className="currency-divider">
                <div className="divider-line"></div>
                <div className="divider-icon">+</div>
                <div className="divider-line"></div>
              </div>

              <div className="currency-card currency-card-fires">
                <div className="currency-header">
                  <Flame size={48} />
                  <h3>🔥 FIRES</h3>
                  <span className="currency-type">Moneda Premium</span>
                </div>
                <div className="currency-features">
                  <div className="currency-feature">
                    <CheckCircle size={18} />
                    <span>Supply controlado dentro de la plataforma</span>
                  </div>
                  <div className="currency-feature">
                    <CheckCircle size={18} />
                    <span>Moneda premium para modos avanzados</span>
                  </div>
                  <div className="currency-feature">
                    <CheckCircle size={18} />
                    <span>Acceso a rifas y premios especiales</span>
                  </div>
                  <div className="currency-feature">
                    <CheckCircle size={18} />
                    <span>Crece con la actividad de la comunidad</span>
                  </div>
                </div>
                <div className="currency-desc">
                  Pensada para los jugadores que quieren participar en los retos y premios más grandes
                </div>
              </div>
            </div>

            <div className="economy-quote">
              <blockquote>
                "Tu diversión genera valor real. Cada partida, cada victoria, 
                cada interacción suma a tu crecimiento personal."
              </blockquote>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* CÓMO FUNCIONA */}
      <FadeInSection>
        <section className="how-it-works-section" id="how-it-works">
          <div className="container">
            <div className="section-header">
              <Zap size={32} className="section-icon" />
              <h2>En 3 Pasos Simples</h2>
              <p>Comienza a jugar en menos de 1 minuto.</p>
            </div>

            <div className="steps-grid">
              <div className="step-card">
                <div className="step-number">1</div>
                <div className="step-icon">
                  <Users size={40} />
                </div>
                <h3>Regístrate con Telegram</h3>
                <p>Rápido y seguro. En menos de 10 segundos estarás dentro.</p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step-card">
                <div className="step-number">2</div>
                <div className="step-icon">
                  <Gift size={40} />
                </div>
                <h3>Configura tu Billetera</h3>
                <p>Aprende cómo funcionan coins y fires y empieza a usarlas en tus juegos.</p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step-card">
                <div className="step-number">3</div>
                <div className="step-icon">
                  <Gamepad2 size={40} />
                </div>
                <h3>Elige tu Juego</h3>
                <p>Bingo, Rifas o TicTacToe. La diversión está garantizada.</p>
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* SEGURIDAD */}
      <FadeInSection>
        <section className="security-section">
          <div className="container">
            <div className="security-content">
              <div className="security-left">
                <Shield size={64} className="security-icon" />
                <h2>Tu Seguridad es Nuestra Prioridad</h2>
                <p className="security-description">
                  Jugamos limpio, transparente y con total seguridad. 
                  Tu confianza es lo más importante para nosotros.
                </p>
              </div>

              <div className="security-features">
                <div className="security-feature">
                  <CheckCircle size={20} />
                  <div>
                    <h4>Economía Transparente</h4>
                    <p>Todas las transacciones son auditables</p>
                  </div>
                </div>
                <div className="security-feature">
                  <CheckCircle size={20} />
                  <div>
                    <h4>Autenticación Telegram</h4>
                    <p>Protección de nivel empresarial</p>
                  </div>
                </div>
                <div className="security-feature">
                  <CheckCircle size={20} />
                  <div>
                    <h4>Sin Pagos Ocultos</h4>
                    <p>Todo es claro desde el inicio</p>
                  </div>
                </div>
                <div className="security-feature">
                  <CheckCircle size={20} />
                  <div>
                    <h4>Comunidad Moderada</h4>
                    <p>Ambiente familiar y respetuoso</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* CTA FINAL */}
      <FadeInSection>
        <section className="final-cta-section">
          <div className="container">
            <div className="final-cta-content">
              <h2>¿Listo Para Empezar?</h2>
              <p>
                Únete a cientos de jugadores que ya están disfrutando y ganando en MUNDOXYZ
              </p>
              <button 
                onClick={() => navigate('/register')} 
                className="btn-final-cta"
              >
                <span>Crear Mi Cuenta Gratis</span>
                <ArrowRight size={24} />
              </button>
              <div className="final-cta-benefits">
                <span><CheckCircle size={16} /> Sin tarjeta de crédito</span>
                <span><CheckCircle size={16} /> Registro en 10 segundos</span>
                <span><CheckCircle size={16} /> MiniApp integrada en Telegram</span>
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <Gamepad2 size={28} />
              <span>MUNDOXYZ</span>
            </div>
            <div className="footer-links">
              <a href="https://t.me/mundoxyz_bot" target="_blank" rel="noopener noreferrer">
                <MessageCircle size={18} />
                Telegram Bot
              </a>
              <button onClick={() => navigate('/login')}>Iniciar Sesión</button>
              <button onClick={() => navigate('/register')}>Registrarse</button>
            </div>
          </div>
          <div className="footer-bottom">
            <p> 2025 MUNDOXYZ - Todos los derechos reservados</p>
            <p className="footer-tagline">Donde tu diversión tiene valor real</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

function generateMultipleBingo75Cards(count) {
  const cards = [];
  const usedHashes = new Set();
  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let card;
    let hash;
    do {
      card = generateSingleBingo75Card();
      hash = getBingoCardHash(card);
      attempts += 1;
      if (attempts > 100) {
        break;
      }
    } while (usedHashes.has(hash));
    usedHashes.add(hash);
    cards.push({ ...card, index: i + 1 });
  }
  return cards;
}

function generateSingleBingo75Card() {
  const ranges = {
    B: { min: 1, max: 15 },
    I: { min: 16, max: 30 },
    N: { min: 31, max: 45 },
    G: { min: 46, max: 60 },
    O: { min: 61, max: 75 }
  };
  const columns = { B: [], I: [], N: [], G: [], O: [] };
  const grid = [];
  const allNumbers = [];
  Object.keys(ranges).forEach((letter) => {
    const range = ranges[letter];
    const numbers = getRandomNumbersInRange(range.min, range.max, 5);
    columns[letter] = numbers.sort((a, b) => a - b);
  });
  for (let row = 0; row < 5; row++) {
    const gridRow = [];
    ['B', 'I', 'N', 'G', 'O'].forEach((letter) => {
      if (letter === 'N' && row === 2) {
        gridRow.push({ value: 'FREE', free: true });
      } else {
        const value = columns[letter][row];
        gridRow.push({ value, free: false });
        allNumbers.push(value);
      }
    });
    grid.push(gridRow);
  }
  columns.N.splice(2, 1);
  return { grid, allNumbers };
}

function getRandomNumbersInRange(min, max, count) {
  const available = [];
  for (let i = min; i <= max; i++) {
    available.push(i);
  }
  const numbers = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const index = Math.floor(Math.random() * available.length);
    const value = available.splice(index, 1)[0];
    numbers.push(value);
  }
  return numbers;
}

function getBingoCardHash(card) {
  if (!card || !Array.isArray(card.allNumbers)) {
    return '';
  }
  const sorted = [...card.allNumbers].sort((a, b) => a - b);
  return sorted.join('-');
}

async function createBingoPdfFromCards(cards) {
  const container = document.createElement('div');
  container.className = 'bingo-print-root';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  document.body.appendChild(container);
  let currentPage = null;
  cards.forEach((card, index) => {
    if (index % 4 === 0) {
      currentPage = document.createElement('div');
      currentPage.className = 'bingo-print-page';
      container.appendChild(currentPage);
    }
    const cardElement = buildPrintableCardElement(card);
    currentPage.appendChild(cardElement);
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  const pages = Array.from(container.querySelectorAll('.bingo-print-page'));
  const pdf = new jsPDF('p', 'pt', 'letter');
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const canvas = await html2canvas(page, {
      backgroundColor: '#ffffff',
      scale: 3
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const renderWidth = imgWidth * ratio;
    const renderHeight = imgHeight * ratio;
    const x = (pdfWidth - renderWidth) / 2;
    const y = (pdfHeight - renderHeight) / 2;
    if (i > 0) {
      pdf.addPage();
    }
    pdf.addImage(imgData, 'JPEG', x, y, renderWidth, renderHeight);
  }
  document.body.removeChild(container);
  const fileName = cards.length === 1 ? 'carton-bingo-75.pdf' : `cartones-bingo-75-${cards.length}.pdf`;
  pdf.save(fileName);
}

function buildPrintableCardElement(card) {
  const wrapper = document.createElement('div');
  wrapper.className = 'bingo-print-card';
  const header = document.createElement('div');
  header.className = 'bingo-print-card-header';
  const title = document.createElement('div');
  title.textContent = 'BINGO 75';
  const code = document.createElement('div');
  code.textContent = `N.º ${card.index}`;
  header.appendChild(title);
  header.appendChild(code);
  const grid = document.createElement('div');
  grid.className = 'bingo-print-grid';
  const headerRow = document.createElement('div');
  headerRow.className = 'bingo-print-grid-header';
  ['B', 'I', 'N', 'G', 'O'].forEach((letter) => {
    const cell = document.createElement('div');
    cell.className = 'bingo-print-cell bingo-print-cell-header';
    cell.textContent = letter;
    headerRow.appendChild(cell);
  });
  grid.appendChild(headerRow);
  card.grid.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'bingo-print-grid-row';
    row.forEach((cellData) => {
      const cell = document.createElement('div');
      cell.className = 'bingo-print-cell';
      if (cellData && cellData.value === 'FREE') {
        cell.className += ' bingo-print-cell-free';
        cell.textContent = 'FREE';
      } else if (cellData && typeof cellData.value === 'number') {
        cell.textContent = String(cellData.value);
      } else {
        cell.textContent = '';
      }
      rowEl.appendChild(cell);
    });
    grid.appendChild(rowEl);
  });
  wrapper.appendChild(header);
  wrapper.appendChild(grid);
  return wrapper;
}

export default Landing;
