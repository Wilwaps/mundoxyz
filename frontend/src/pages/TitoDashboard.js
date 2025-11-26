import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const TitoDashboard = () => {
  const { user } = useAuth();

  const [inviteUrl, setInviteUrl] = useState('');
  const isTito = !!user?.roles?.includes('tito');

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['tito-summary'],
    queryFn: async () => {
      const res = await axios.get('/api/commissions/tito/me/summary');
      return res.data;
    },
    enabled: isTito
  });

  const { data: referralsData, isLoading: loadingReferrals } = useQuery({
    queryKey: ['tito-referrals'],
    queryFn: async () => {
      const res = await axios.get('/api/commissions/tito/me/referrals', {
        params: { limit: 50 }
      });
      return res.data;
    },
    enabled: isTito
  });

  const { data: opsData, isLoading: loadingOps } = useQuery({
    queryKey: ['tito-operations'],
    queryFn: async () => {
      const res = await axios.get('/api/commissions/tito/me/operations', {
        params: { limit: 20 }
      });
      return res.data;
    },
    enabled: isTito
  });

  const handleGenerateLink = async () => {
    try {
      const res = await axios.post('/api/commissions/tito/me/link');
      const { inviteUrl: generatedInviteUrl } = res.data;

      if (generatedInviteUrl) {
        setInviteUrl(generatedInviteUrl);
      }

      if (navigator.clipboard && generatedInviteUrl) {
        await navigator.clipboard.writeText(generatedInviteUrl);
        toast.success('Link de Tito copiado al portapapeles');
      } else {
        toast.success('Link generado', { duration: 2000 });
      }
    } catch (error) {
      console.error('Error generating Tito link', error);
      toast.error(error.response?.data?.error || 'No se pudo generar el link de Tito');
    }
  };

  if (!isTito) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="card-glass p-6 text-center">
          <h1 className="text-2xl font-bold mb-2 text-gradient-violet">Panel Tito</h1>
          <p className="text-text/70">Actualmente tu cuenta no tiene asignado el rol de Tito.</p>
        </div>
      </div>
    );
  }

  const summary = summaryData?.summary || {
    total_tito_commission: 0,
    total_tito_base: 0,
    total_tito_referral: 0,
    operations: 0
  };
  const byType = summaryData?.byType || [];
  const operations = opsData?.operations || [];
  const referrals = referralsData?.referrals || [];

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center shadow-neon-violet">
          <Sparkles className="text-background-dark" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gradient-violet">Panel Tito</h1>
          <p className="text-text/60 text-sm">Resumen de tus comisiones generadas en MundoXYZ.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass p-4">
          <p className="text-xs text-text/60 mb-1">Total comisiones Tito</p>
          <p className="text-2xl font-bold text-orange-400">
            {Number(summary.total_tito_commission || 0).toFixed(2)} 🔥
          </p>
          <p className="text-xs text-text/50 mt-1">Suma de todas las operaciones donde fuiste Tito.</p>
        </div>
        <div className="card-glass p-4">
          <p className="text-xs text-text/60 mb-1">Por tu propia actividad</p>
          <p className="text-xl font-semibold text-emerald-400">
            {Number(summary.total_tito_base || 0).toFixed(2)} 🔥
          </p>
          <p className="text-xs text-text/50 mt-1">Comisión base por ser Tito (tus propios retiros/envíos/juegos).</p>
        </div>
        <div className="card-glass p-4">
          <p className="text-xs text-text/60 mb-1">Por tu comunidad</p>
          <p className="text-xl font-semibold text-sky-400">
            {Number(summary.total_tito_referral || 0).toFixed(2)} 🔥
          </p>
          <p className="text-xs text-text/50 mt-1">Comisión generada por usuarios que entraron con tu link.</p>
        </div>
      </div>

      <div className="card-glass p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Tu link de Tito</h2>
          <p className="text-xs text-text/60 mt-1">
            Genera o recupera tu link personal de invitación. Cada usuario que entre con tu link y use la plataforma
            sumará comisiones a este panel.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary px-4 py-2 text-sm"
          onClick={handleGenerateLink}
        >
          Generar / Copiar link
        </button>
      </div>

      {inviteUrl && (
        <div className="card-glass p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text/60 mb-1">Link actual</p>
            <p className="text-[11px] break-all text-text/80">{inviteUrl}</p>
          </div>
          <div className="flex flex-col items-center gap-2 mt-3 md:mt-0">
            <p className="text-xs text-text/60">QR para compartir tu link</p>
            <div className="bg-background-dark/80 p-2 rounded-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  inviteUrl
                )}`}
                alt="QR link de Tito"
                className="w-32 h-32 md:w-40 md:h-40"
              />
            </div>
          </div>
        </div>
      )}

      <div className="card-glass p-4">
        <h3 className="text-sm font-semibold mb-2">Usuarios registrados</h3>
        {loadingReferrals ? (
          <p className="text-xs text-text/60">Cargando...</p>
        ) : referrals.length === 0 ? (
          <p className="text-xs text-text/60">Aún no tienes usuarios registrados con tu link.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs align-middle">
              <thead>
                <tr className="text-text/60 border-b border-glass">
                  <th className="py-1 pr-3 text-left">Usuario</th>
                  <th className="py-1 pr-3 text-left">Fecha de registro</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => (
                  <tr key={ref.id} className="border-b border-glass/40">
                    <td className="py-1 pr-3 text-text/80">{ref.username}</td>
                    <td className="py-1 pr-3 text-text/70">
                      {ref.created_at ? new Date(ref.created_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass p-4 md:col-span-1">
          <h3 className="text-sm font-semibold mb-2">Comisiones por tipo de operación</h3>
          {loadingSummary ? (
            <p className="text-xs text-text/60">Cargando...</p>
          ) : byType.length === 0 ? (
            <p className="text-xs text-text/60">Aún no tienes comisiones registradas.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {byType.map((row) => (
                <li key={row.operation_type} className="flex justify-between">
                  <span className="uppercase text-text/60">{row.operation_type}</span>
                  <span className="font-semibold text-orange-300">
                    {Number(row.total_tito_commission || 0).toFixed(2)} 🔥
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-glass p-4 md:col-span-2 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-2">Últimas operaciones</h3>
          {loadingOps ? (
            <p className="text-xs text-text/60">Cargando...</p>
          ) : operations.length === 0 ? (
            <p className="text-xs text-text/60">No hay operaciones todavía.</p>
          ) : (
            <table className="min-w-full text-xs align-middle">
              <thead>
                <tr className="text-text/60 border-b border-glass">
                  <th className="py-1 pr-3 text-left">Fecha</th>
                  <th className="py-1 pr-3 text-left">Tipo</th>
                  <th className="py-1 pr-3 text-right">Base</th>
                  <th className="py-1 pr-3 text-right">Tito</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op) => (
                  <tr key={op.id} className="border-b border-glass/40">
                    <td className="py-1 pr-3 text-text/80">
                      {new Date(op.created_at).toLocaleString()}
                    </td>
                    <td className="py-1 pr-3 text-text/70 uppercase">{op.operation_type}</td>
                    <td className="py-1 pr-3 text-right text-text/80">
                      {Number(op.amount_base || 0).toFixed(2)}
                    </td>
                    <td className="py-1 pr-3 text-right text-orange-300 font-semibold">
                      {Number(op.tito_commission_amount || 0).toFixed(2)} 🔥
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default TitoDashboard;
