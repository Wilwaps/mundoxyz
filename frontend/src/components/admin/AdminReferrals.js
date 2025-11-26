import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Users, Activity, TrendingUp, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const REFERRAL_SOURCES = [
  { key: 'withdrawal', label: 'Retiros' },
  { key: 'transfer', label: 'Transferencias' },
  { key: 'bingo_room', label: 'Salas de bingo' },
  { key: 'raffle_fire_room', label: 'Rifas (fuegos)' },
  { key: 'store', label: 'Tiendas' }
];

const AdminReferrals = () => {
  const { isTote } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: configData,
    isLoading: configLoading,
    error: configError
  } = useQuery({
    queryKey: ['referrals-config'],
    queryFn: async () => {
      const response = await axios.get('/api/referrals/config');
      return response.data;
    },
    enabled: isTote()
  });

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError
  } = useQuery({
    queryKey: ['referrals-stats'],
    queryFn: async () => {
      const response = await axios.get('/api/referrals/stats');
      return response.data;
    },
    enabled: isTote()
  });

  const [configForm, setConfigForm] = useState({
    enabled: false,
    enable_withdrawals: false,
    enable_transfers: false,
    enable_bingo_rooms: false,
    enable_raffle_fire_rooms: false,
    enable_stores: false
  });
  const [levelsForm, setLevelsForm] = useState([]);

  useEffect(() => {
    if (!configData) return;
    const cfg = configData.config || {};
    setConfigForm({
      enabled: !!cfg.enabled,
      enable_withdrawals: !!cfg.enable_withdrawals,
      enable_transfers: !!cfg.enable_transfers,
      enable_bingo_rooms: !!cfg.enable_bingo_rooms,
      enable_raffle_fire_rooms: !!cfg.enable_raffle_fire_rooms,
      enable_stores: !!cfg.enable_stores
    });

    const levelsBySource = configData.levels || {};
    const nextLevels = [];

    REFERRAL_SOURCES.forEach((src) => {
      const items = Array.isArray(levelsBySource[src.key]) ? levelsBySource[src.key] : [];
      for (let lvl = 1; lvl <= 5; lvl += 1) {
        const existing = items.find((row) => Number(row.level) === lvl);
        nextLevels.push({
          source: src.key,
          level: lvl,
          percentage: existing ? Number(existing.percentage) || 0 : 0,
          active: existing ? existing.active !== false : false
        });
      }
    });

    setLevelsForm(nextLevels);
  }, [configData]);

  const updateConfigMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axios.post('/api/referrals/config', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Configuración de referidos actualizada');
      queryClient.invalidateQueries(['referrals-config']);
      queryClient.invalidateQueries(['referrals-stats']);
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al actualizar configuración de referidos';
      toast.error(message);
    }
  });

  const handleToggle = (field) => {
    setConfigForm((prev) => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleLevelChange = (source, level, field, value) => {
    setLevelsForm((prev) =>
      prev.map((row) =>
        row.source === source && row.level === level
          ? {
              ...row,
              [field]: field === 'percentage' ? value : value
            }
          : row
      )
    );
  };

  const handleSave = async () => {
    if (!isTote()) {
      toast.error('Solo el rol Tote puede actualizar la configuración de referidos');
      return;
    }

    const payloadLevels = levelsForm.map((row) => ({
      source: row.source,
      level: row.level,
      percentage: Number(row.percentage) || 0,
      active: !!row.active
    }));

    const payload = {
      ...configForm,
      levels: payloadLevels
    };

    await updateConfigMutation.mutateAsync(payload);
  };

  if (!isTote()) {
    return (
      <div className="p-4">
        <div className="card-glass p-6 text-sm text-text/70">
          Solo el rol Tote puede ver la configuración de referidos.
        </div>
      </div>
    );
  }

  const groupedLevels = {};
  REFERRAL_SOURCES.forEach((src) => {
    groupedLevels[src.key] = levelsForm.filter((row) => row.source === src.key);
  });

  const taps = statsData?.taps || null;
  const topByCount = Array.isArray(statsData?.top_referrers_by_count)
    ? statsData.top_referrers_by_count
    : [];
  const topByCommission = Array.isArray(statsData?.top_referrers_by_commission)
    ? statsData.top_referrers_by_commission
    : [];

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Users size={20} className="text-accent" />
        Sistema de referidos
      </h2>

      {(configLoading || statsLoading) && (
        <div className="flex items-center gap-2 text-sm text-text/60">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
          <span>Cargando configuración de referidos...</span>
        </div>
      )}

      {(configError || statsError) && (
        <div className="card-glass bg-error/10 border border-error/40 p-3 text-xs text-error">
          Error al cargar datos de referidos. Revisa los logs del servidor.
        </div>
      )}

      <div className="card-glass p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-text/80">Configuración global</div>
            <div className="text-xs text-text/60">
              Controla si el sistema de referidos está activo y en qué fuentes se aplica.
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <span>Sistema activo</span>
            <input
              type="checkbox"
              checked={configForm.enabled}
              onChange={() => handleToggle('enabled')}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <label className="flex items-center justify-between gap-2">
            <span className="text-text/70">Retiros</span>
            <input
              type="checkbox"
              checked={configForm.enable_withdrawals}
              onChange={() => handleToggle('enable_withdrawals')}
              disabled={!configForm.enabled}
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-text/70">Transferencias</span>
            <input
              type="checkbox"
              checked={configForm.enable_transfers}
              onChange={() => handleToggle('enable_transfers')}
              disabled={!configForm.enabled}
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-text/70">Salas de bingo</span>
            <input
              type="checkbox"
              checked={configForm.enable_bingo_rooms}
              onChange={() => handleToggle('enable_bingo_rooms')}
              disabled={!configForm.enabled}
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-text/70">Rifas (fuegos)</span>
            <input
              type="checkbox"
              checked={configForm.enable_raffle_fire_rooms}
              onChange={() => handleToggle('enable_raffle_fire_rooms')}
              disabled={!configForm.enabled}
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-text/70">Tiendas</span>
            <input
              type="checkbox"
              checked={configForm.enable_stores}
              onChange={() => handleToggle('enable_stores')}
              disabled={!configForm.enabled}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateConfigMutation.isLoading}
            className="px-4 py-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateConfigMutation.isLoading ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {REFERRAL_SOURCES.map((src) => {
            const rows = groupedLevels[src.key] || [];
            return (
              <div key={src.key} className="card-glass p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-text/80">{src.label}</div>
                  <span className="text-[11px] text-text/60">Porcentajes por nivel (0-5%)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-text/50 border-b border-glass">
                      <tr>
                        <th className="text-left py-2 pr-2">Nivel</th>
                        <th className="text-right py-2 pr-2">Porcentaje (%)</th>
                        <th className="text-right py-2 pl-2">Activo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.level} className="border-b border-glass/40 last:border-b-0">
                          <td className="py-1.5 pr-2">{row.level}</td>
                          <td className="py-1.5 pr-2 text-right">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={row.percentage}
                              onChange={(e) =>
                                handleLevelChange(
                                  src.key,
                                  row.level,
                                  'percentage',
                                  e.target.value
                                )
                              }
                              className="w-20 px-2 py-1 bg-glass rounded text-right"
                              disabled={!configForm.enabled}
                            />
                          </td>
                          <td className="py-1.5 pl-2 text-right">
                            <input
                              type="checkbox"
                              checked={row.active}
                              onChange={(e) =>
                                handleLevelChange(
                                  src.key,
                                  row.level,
                                  'active',
                                  e.target.checked
                                )
                              }
                              disabled={!configForm.enabled}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="card-glass p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-accent" />
              <h3 className="text-sm font-semibold text-text/80">Taps</h3>
            </div>
            {taps ? (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-text/60">Total</span>
                  <span className="font-semibold">{taps.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">Últimas 24h</span>
                  <span className="font-semibold">{taps.last_24h}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">Últimos 7 días</span>
                  <span className="font-semibold">{taps.last_7d}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">Últimos 30 días</span>
                  <span className="font-semibold">{taps.last_30d}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text/60">Sin datos de taps aún.</p>
            )}
          </div>

          <div className="card-glass p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-accent" />
              <h3 className="text-sm font-semibold text-text/80">Top referidores (cantidad)</h3>
            </div>
            {topByCount.length === 0 ? (
              <p className="text-xs text-text/60">Aún no hay usuarios con referidos.</p>
            ) : (
              <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                {topByCount.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between border-b border-glass/40 last:border-b-0 py-1"
                  >
                    <div>
                      <div className="font-semibold text-text text-sm">
                        {row.display_name || row.username}
                      </div>
                      <div className="text-[11px] text-text/60">@{row.username}</div>
                    </div>
                    <div className="text-sm font-semibold text-accent">
                      {row.total_referrals}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-glass p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={16} className="text-fire-orange" />
              <h3 className="text-sm font-semibold text-text/80">Top referidores (comisión)</h3>
            </div>
            {topByCommission.length === 0 ? (
              <p className="text-xs text-text/60">Sin comisiones registradas todavía.</p>
            ) : (
              <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                {topByCommission.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between border-b border-glass/40 last:border-b-0 py-1"
                  >
                    <div>
                      <div className="font-semibold text-text text-sm">
                        {row.display_name || row.username}
                      </div>
                      <div className="text-[11px] text-text/60">@{row.username}</div>
                    </div>
                    <div className="text-sm font-semibold text-fire-orange">
                      {Number(row.total_commission || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReferrals;
