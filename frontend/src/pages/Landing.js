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
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicStats();
    
    // Actualizar stats cada 30 segundos
    const interval = setInterval(fetchPublicStats, 30000);
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
      if (!value) return;
      
      const numValue = parseFloat(value);
      const duration = 2000;
      const steps = 60;
      const increment = numValue / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= numValue) {
          setDisplayValue(numValue);
          clearInterval(timer);
        } else {
          setDisplayValue(current);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }, [value]);

    return (
      <span>
        {displayValue.toLocaleString('es-ES', { 
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
              Juega Bingo, Rifas y Duelos con coins y fires mientras construyes tu economía dentro de la plataforma.
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
                        suffix=" 🪙"
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
                  <h3>Rifas con Premios Reales</h3>
                </div>
                <div className="game-card-body">
                  <p className="game-description">
                    Crea tu propia rifa o compra números en rifas existentes. Gana premios en fires, coins 
                    o premios físicos/digitales con un sistema 100% justo y auditable.
                  </p>
                  <ul className="game-features">
                    <li><CheckCircle size={16} /> Crea rifas personalizadas</li>
                    <li><CheckCircle size={16} /> Compra con coins o fires (según la rifa)</li>
                    <li><CheckCircle size={16} /> Premios físicos o digitales</li>
                    <li><CheckCircle size={16} /> Sistema transparente</li>
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
                  <h3>🪙 COINS</h3>
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
            <p>© 2025 MUNDOXYZ - Todos los derechos reservados</p>
            <p className="footer-tagline">Donde tu diversión tiene valor real</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
