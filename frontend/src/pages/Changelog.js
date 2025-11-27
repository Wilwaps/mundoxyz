import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';

const Changelog = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-changelog'],
    queryFn: async () => {
      const response = await axios.get('/api/public/changelog');
      return response.data;
    }
  });

  const entries = Array.isArray(data?.entries) ? data.entries : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark via-dark to-black text-text">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Changelog MundoXYZ</h1>
        <p className="text-sm text-text/60 mb-6">
          Mensajes y cambios importantes publicados por el panel admin/tote.
        </p>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {error && !isLoading && (
          <div className="card-glass border border-error/40 bg-error/10 p-4 text-sm text-error">
            Error al cargar el changelog.
          </div>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <div className="card-glass p-6 text-sm text-text/60">
            Aún no hay mensajes publicados.
          </div>
        )}

        <div className="space-y-4">
          {entries.map((entry) => {
            const createdAt = entry.created_at ? new Date(entry.created_at) : null;
            const formattedDate = createdAt && !Number.isNaN(createdAt.getTime())
              ? createdAt.toLocaleString('es-VE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : null;

            return (
              <motion.article
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-glass p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <h2 className="text-lg font-semibold text-text">{entry.title}</h2>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {entry.category && (
                      <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent uppercase tracking-wide">
                        {entry.category}
                      </span>
                    )}
                    {entry.version && (
                      <span className="px-2 py-0.5 rounded-full bg-glass text-text/80">
                        Versin {entry.version}
                      </span>
                    )}
                    {formattedDate && (
                      <span className="text-text/50">{formattedDate}</span>
                    )}
                  </div>
                </div>

                <div
                  className="prose prose-sm prose-invert max-w-none text-text/80"
                  // El contenido es controlado por admin/tote
                  dangerouslySetInnerHTML={{ __html: entry.content_html || '' }}
                />
              </motion.article>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Changelog;
