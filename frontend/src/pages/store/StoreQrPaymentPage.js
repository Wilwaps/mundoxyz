import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';

const StoreQrPaymentPage = () => {
    const { slug, qrSessionId } = useParams();
    const navigate = useNavigate();

    const hasQrSessionIdInUrl = !!qrSessionId;

    const {
        data,
        isLoading,
        isError,
        refetch
    } = useQuery({
        queryKey: hasQrSessionIdInUrl ? ['store-qr-session', qrSessionId] : ['store-qr-latest', slug],
        queryFn: async () => {
            if (hasQrSessionIdInUrl) {
                const response = await axios.get(`/api/store/order/qr/${qrSessionId}`);
                return response.data;
            }

            if (!slug) {
                throw new Error('Slug de tienda no definido');
            }

            const response = await axios.get('/api/store/order/qr/latest', {
                params: { storeSlug: slug }
            });
            return response.data;
        }
    });

    const effectiveQrSessionId = hasQrSessionIdInUrl ? qrSessionId : data?.qr_session_id;

    const payMutation = useMutation({
        mutationFn: async () => {
            if (!effectiveQrSessionId) {
                throw new Error('Sesión de pago QR no disponible');
            }
            const response = await axios.post(`/api/store/order/qr/${effectiveQrSessionId}/pay`);
            return response.data;
        },
        onSuccess: (res) => {
            toast.success('Pago QR completado con éxito');
            const storeId = res?.store_id || data?.store_id;
            const invoiceNumber = res?.invoice_number || data?.invoice_number;

            if (slug && invoiceNumber != null) {
                navigate(`/store/${slug}/invoice/${invoiceNumber}`);
            } else if (storeId) {
                void refetch();
            }
        },
        onError: (error) => {
            const message = error?.response?.data?.error || 'No se pudo completar el pago QR';
            toast.error(message);
            void refetch();
        }
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="spinner" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="max-w-sm w-full bg-slate-900/70 border border-red-500/40 rounded-xl p-4 text-center text-sm text-white/80">
                    {hasQrSessionIdInUrl
                        ? 'Ocurrió un error al cargar la sesión de pago QR.'
                        : 'No se encontró ninguna sesión de pago QR pendiente para esta tienda.'}
                </div>
            </div>
        );
    }

    const firesAmount = Number(data.total_fires || 0);
    const storeName = data.store_name || 'Tienda';

    const isExpired = !!data.is_expired;
    const isAlreadyPaid = data.payment_status === 'paid';

    return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="max-w-sm w-full bg-slate-900/80 border border-white/10 rounded-2xl p-5 shadow-xl text-white">
                <div className="text-xs uppercase tracking-wide text-white/50 mb-1">
                    Pago con Fires
                </div>
                <div className="text-lg font-semibold mb-2 truncate">
                    {storeName}
                </div>

                <div className="mt-3 mb-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
                    <div className="text-xs text-white/60 mb-1">
                        Monto a pagar
                    </div>
                    <div className="text-2xl font-bold text-orange-300">
                        {Number.isFinite(firesAmount) ? firesAmount : 0} Fires
                    </div>
                </div>

                {isExpired && (
                    <div className="mb-3 text-xs text-red-400 text-center">
                        Esta sesión de pago QR ha expirado. Pide al comercio que genere un nuevo QR.
                    </div>
                )}

                {isAlreadyPaid && (
                    <div className="mb-3 text-xs text-emerald-400 text-center">
                        Esta orden ya figura como pagada.
                    </div>
                )}

                {!isExpired && !isAlreadyPaid && (
                    <button
                        type="button"
                        onClick={() => payMutation.mutate()}
                        disabled={payMutation.isLoading}
                        className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {payMutation.isLoading ? 'Procesando pago…' : 'Pagar con mis Fires'}
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="mt-3 w-full py-2 rounded-xl border border-white/10 text-xs text-white/70 hover:bg-white/5"
                >
                    Volver
                </button>
            </div>
        </div>
    );
};

export default StoreQrPaymentPage;
