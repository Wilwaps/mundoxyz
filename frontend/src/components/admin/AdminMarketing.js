import React from 'react';

const AdminMarketing = () => {
  return (
    <div className="p-4 flex flex-col gap-4 min-h-[calc(100vh-80px)]">
      <div className="card-glass p-4">
        <h2 className="text-2xl font-bold mb-1">Marketing Command Center</h2>
        <p className="text-sm text-text/70">
          Panel de marketing integrado dentro de MundoXYZ. Usa este panel para planificar, lanzar y hacer
          seguimiento de campañas sin salir de la plataforma.
        </p>
      </div>
      <div className="flex-1 card-glass overflow-hidden min-h-[420px] md:min-h-[500px]">
        <iframe
          src="/marketing"
          title="Marketing Command Center"
          className="w-full h-[70vh] md:h-[calc(100vh-260px)] min-h-[420px] md:min-h-[500px] border-0 rounded-xl bg-black"
        />
      </div>
    </div>
  );
};

export default AdminMarketing;
