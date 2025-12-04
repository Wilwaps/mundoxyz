import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Changelog = () => {
  const { isAdmin } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-changelog'],
    queryFn: async () => {
      const response = await axios.get('/api/public/changelog');
      return response.data;
    }
  });

  const entries = useMemo(() => Array.isArray(data?.entries) ? data.entries : [], [data?.entries]);

  const normalizedEntries = useMemo(
    () =>
      entries.map((entry) => {
        const createdAt = entry.created_at ? new Date(entry.created_at) : null;
        let dateLabel = null;
        let timeLabel = null;
        let dateKey = null;

        if (createdAt && !Number.isNaN(createdAt.getTime())) {
          dateLabel = createdAt.toLocaleDateString('es-VE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          });
          timeLabel = createdAt.toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit'
          });
          dateKey = createdAt.toISOString().slice(0, 10);
        }

        return {
          entry,
          createdAt,
          dateLabel,
          timeLabel,
          dateKey
        };
      }),
    [entries]
  );

  return (
    <div className="min-h-screen bg-background-dark text-text">
      {/* Header */}
      <div className="bg-card border-b border-border-glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-text mb-2">Changelog MundoXYZ</h1>
              <p className="text-lg text-text-secondary">
                Novedades, características y mejoras de la plataforma
              </p>

              {/* Toolbar móvil (solo Admin/Tote) */}
              {isAdmin() && (
                <div className="mt-4 flex flex-wrap gap-2 md:hidden">
                  <Link
                    to="/admin/changelog"
                    className="px-4 py-2 text-sm font-medium rounded-md bg-glass text-text-secondary hover:bg-glass-hover border border-border-glass transition-colors w-full sm:w-auto text-center"
                  >
                    Editar changelog
                  </Link>
                </div>
              )}
            </div>
            <div className="hidden md:flex gap-3 items-center">
              <a
                href="/docs"
                className="px-4 py-2 text-sm font-medium rounded-md border border-theme bg-glass hover:bg-glass-hover transition-colors"
              >
                Ver Docs
              </a>
              <a
                href="/support"
                className="px-4 py-2 text-sm font-medium rounded-md bg-gradient-primary text-background-dark shadow-button hover:opacity-90 transition-colors"
              >
                Soporte
              </a>
              {isAdmin() && (
                <Link
                  to="/admin/changelog"
                  className="px-4 py-2 text-sm font-medium rounded-md bg-glass text-text-secondary hover:bg-glass-hover border border-border-glass transition-colors"
                >
                  Editar changelog
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-card border border-error/40 rounded-lg p-4 text-sm text-error shadow-card">
            Error al cargar el changelog.
          </div>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <div className="bg-card rounded-lg p-8 text-center shadow-card border border-border-glass">
            <div className="text-text-secondary">
              <svg className="w-12 h-12 mx-auto mb-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium mb-2">No hay novedades aún</p>
              <p className="text-sm text-text-muted">Pronto verás las últimas actualizaciones aquí.</p>
            </div>
          </div>
        )}

        <div className="space-y-12">
          {(() => {
            let lastDateKey = null;

            return normalizedEntries.map(({ entry, dateLabel, timeLabel, dateKey }) => {
              const showDateHeader = dateKey && dateKey !== lastDateKey;
              if (dateKey) {
                lastDateKey = dateKey;
              }

              return (
                <React.Fragment key={entry.id}>
                  {showDateHeader && (
                    <div className="pt-8 border-t border-border-glass">
                      <div className="flex items-center gap-4 mb-8">
                        <h2 className="text-2xl font-bold text-text">{dateLabel}</h2>
                        <div className="flex-1 h-px bg-gradient-to-r from-accent/40 to-transparent" />
                      </div>
                    </div>
                  )}

                  <motion.article
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="card-glass overflow-hidden"
                  >
                    <div className="p-6 lg:p-8">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-text mb-2">
                            {entry.title}
                          </h3>
                          {entry.category && (
                            <span className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-glass text-text-secondary border border-border-glass">
                              {entry.category}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                          {entry.version && (
                            <span className="px-3 py-1 font-mono text-sm rounded-md bg-glass text-text-secondary border border-border-glass">
                              Versión {entry.version}
                            </span>
                          )}
                          {timeLabel && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {timeLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <div 
                        className="prose prose-lg max-w-none text-text-secondary"
                        dangerouslySetInnerHTML={{ __html: entry.content_html || '' }}
                      />
                    </div>
                  </motion.article>
                </React.Fragment>
              );
            });
          })()}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card text-text mt-20 border-t border-border-glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <h3 className="text-2xl font-bold mb-4 text-text">MUNDOXYZ</h3>
              <p className="text-text-secondary mb-6">
                Espacio digital para comerciar, jugar y conectar
              </p>
              <div className="flex gap-4">
                <button className="text-text-secondary hover:text-text transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </button>
                <button className="text-text-secondary hover:text-text transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4 text-text">Producto</h4>
              <ul className="space-y-2">
                <li><button className="text-text-secondary hover:text-text transition-colors text-left">Tiendas</button></li>
                <li><button className="text-text-secondary hover:text-text transition-colors text-left">Juegos</button></li>
                <li><button className="text-text-secondary hover:text-text transition-colors text-left">Economía</button></li>
                <li><button className="text-text-secondary hover:text-text transition-colors text-left">Precios</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4 text-text">Empresa</h4>
              <ul className="space-y-2">
                <li><button className="text-text-secondary hover:text-text transition-colors text-left">Sobre nosotros</button></li>
                <li><button className="text-text-secondary hover:text-text transition-colors text-left">Blog</button></li>
                <li><button className="text-text-secondary hover:text-text transition-colors text-left">Soporte</button></li>
                <li><button className="text-text-secondary hover:text-text transition-colors text-left">Contacto</button></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border-glass mt-8 pt-8 text-center text-text-secondary">
            <p className="text-sm">&copy; 2025 MUNDOXYZ. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Changelog;
