import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Gamepad2, Sparkles, TrendingUp, Wallet, Users, Info, ArrowRight } from 'lucide-react';
import './Landing.css';

const TitoLanding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName = user?.display_name || user?.username || 'Tito';

  return (
    <div className="landing-page">
      {/* HEADER público reutilizando el de Landing */}
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

      <main className="mt-8 mb-12">
        <div className="container">
          <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Hero */}
      <div className="card-glass p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-400 via-pink-500 to-violet flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Sparkles className="text-background-dark" size={26} />
          </div>
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-500/10 border border-orange-400/40 text-[11px] font-semibold text-orange-300 mb-2 uppercase tracking-wide">
              <span className="mr-1">
                <span role="img" aria-label="persona">👦</span>
                <span role="img" aria-label="cohete" className="ml-1">🚀</span>
              </span>
              tito
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2 text-gradient-violet">
              Rol Tito · Comisiones por hacer crecer MundoXYZ
            </h1>
            <p className="text-sm md:text-base text-text/70 max-w-xl">
              {displayName}, el rol <span className="font-semibold">Tito</span> reconoce a las personas que ayudan a que
              más gente use MundoXYZ. Cada vez que tu comunidad mueve fuegos, tú participas en las comisiones de la
              plataforma.
            </p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4 min-w-[220px] text-sm space-y-2">
          <p className="text-xs text-text/60 font-semibold uppercase tracking-wide">Resumen rápido</p>
          <ul className="space-y-1 text-text/80 text-xs md:text-sm">
            <li>· Ganas comisiones cuando la gente hace retiros y movimientos con fuegos.</li>
            <li>· Tienes un panel propio para ver tus números como Tito.</li>
            <li>· Todo se controla desde tu perfil dentro de MundoXYZ.</li>
          </ul>
        </div>
      </div>

      {/* Cómo ganas dinero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-orange-300" />
            <h2 className="text-sm font-semibold text-text">Comisión por retiros</h2>
          </div>
          <p className="text-xs text-text/70">
            Cuando los usuarios hacen <span className="font-semibold">retiros o canjes</span> desde su wallet, se cobra una
            comisión. Como Tito, recibes una parte de esas comisiones.
          </p>
        </div>
        <div className="card-glass p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-300" />
            <h2 className="text-sm font-semibold text-text">Tu propia actividad</h2>
          </div>
          <p className="text-xs text-text/70">
            Una fracción de las comisiones generadas por <span className="font-semibold">tus propios retiros y uso de la
            plataforma</span> también suma a tu panel Tito como comisión base.
          </p>
        </div>
        <div className="card-glass p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-sky-300" />
            <h2 className="text-sm font-semibold text-text">Tu comunidad</h2>
          </div>
          <p className="text-xs text-text/70">
            Si las personas entran a MundoXYZ usando tu <span className="font-semibold">link de Tito</span>, una parte de
            las comisiones que generen esas cuentas también se reparte contigo.
          </p>
        </div>
      </div>

      {/* Dónde encuentro mi menú Tito */}
      <div className="card-glass p-5 md:p-6 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Info size={18} className="text-accent" />
          <h2 className="text-base md:text-lg font-semibold text-text">¿Dónde veo mi menú y panel Tito?</h2>
        </div>
        <p className="text-xs md:text-sm text-text/70">
          Todo lo relacionado con Tito vive dentro de tu perfil de MundoXYZ. No necesitas ir a otra web ni salir de la
          miniapp.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-xs md:text-sm text-text/80">
          <li>
            Abre el menú principal y entra en <span className="font-semibold">Perfil</span>.
          </li>
          <li>
            Dentro de tu perfil, ve a la sección <span className="font-semibold">Roles</span>.
          </li>
          <li>
            Allí verás la pestaña <span className="font-semibold text-orange-300">Tito</span> con una explicación rápida
            del rol y cómo funciona.
          </li>
          <li>
            Desde el menú principal también puedes acceder al <span className="font-semibold">Panel Tito</span> cuando
            tengas activado el rol.
          </li>
        </ol>
      </div>

      {/* Buenas prácticas y aclaraciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-glass p-4 space-y-2 text-xs md:text-sm text-text/80">
          <h2 className="text-sm font-semibold text-text mb-1">Buenas prácticas para un buen Tito</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Explica a tu comunidad cómo funciona MundoXYZ y los riesgos de los juegos.</li>
            <li>No prometas ganancias fijas ni seguras. La comisión depende de la actividad real.</li>
            <li>Comparte tu link solo con personas que realmente quieran usar la plataforma.</li>
            <li>Mantente disponible para ayudar a tus invitados en sus primeras interacciones.</li>
          </ul>
        </div>
        <div className="card-glass p-4 space-y-3 text-xs md:text-sm text-text/80">
          <h2 className="text-sm font-semibold text-text mb-1">Detalles importantes</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Las comisiones se calculan automáticamente según las reglas internas de MundoXYZ.</li>
            <li>Puedes ver el detalle de operaciones y montos en tu Panel Tito.</li>
            <li>El rol Tito es asignado manualmente por el equipo; no se compra ni se vende.</li>
            <li>Si pierdes acceso o ves algo raro en tus comisiones, contacta soporte desde tu perfil.</li>
          </ul>
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="text-[11px] text-text/50 max-w-xs">
              Esta página es solo informativa. Los datos reales de comisiones siempre se ven dentro del Panel Tito.
            </div>
            <button
              type="button"
              className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent/15 hover:bg-accent/25 text-[11px] font-semibold text-accent transition-colors"
            >
              <span>Ir a Perfil</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TitoLanding;
