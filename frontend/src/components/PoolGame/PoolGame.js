import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

const PoolGame = ({ room, user, socket, gameState, isMyTurn }) => {
    const sceneRef = useRef(null);
    const engineRef = useRef(null);
    const renderRef = useRef(null);
    const cueBallRef = useRef(null);
    const ballsRef = useRef([]);
    const isShotInProgressRef = useRef(false);
    const aimingRef = useRef(false);

    const [cueState, setCueState] = useState({
        visible: false,
        angle: -Math.PI / 2,
        power: 0,
        cueBall: { x: 0, y: 0 }
    });

    // Mesa vertical pensada para móvil / Telegram
    const TABLE_WIDTH = 380;
    const TABLE_HEIGHT = 720;
    const BALL_RADIUS = 10;
    const MAX_DRAG_DISTANCE = 140;
    const FORCE_SCALE = 0.0008;

    useEffect(() => {
        if (!sceneRef.current) return;

        const Engine = Matter.Engine;
        const Render = Matter.Render;
        const World = Matter.World;
        const Bodies = Matter.Bodies;

        const engine = Engine.create();
        engine.world.gravity.y = 0;

        const render = Render.create({
            element: sceneRef.current,
            engine,
            options: {
                width: TABLE_WIDTH,
                height: TABLE_HEIGHT,
                wireframes: false,
                background: '#020617'
            }
        });

        // Bandas (cushions)
        const wallOptions = { isStatic: true, render: { fillStyle: '#14532d' }, restitution: 0.9 };
        const walls = [
            Bodies.rectangle(TABLE_WIDTH / 2, 18, TABLE_WIDTH - 80, 24, wallOptions),
            Bodies.rectangle(TABLE_WIDTH / 2, TABLE_HEIGHT - 18, TABLE_WIDTH - 80, 24, wallOptions),
            Bodies.rectangle(18, TABLE_HEIGHT / 2, 24, TABLE_HEIGHT - 80, wallOptions),
            Bodies.rectangle(TABLE_WIDTH - 18, TABLE_HEIGHT / 2, 24, TABLE_HEIGHT - 80, wallOptions)
        ];
        World.add(engine.world, walls);

        // Bolas
        const balls = [];
        const rackX = TABLE_WIDTH / 2;
        const rackY = TABLE_HEIGHT * 0.35;

        const cueBall = Bodies.circle(TABLE_WIDTH / 2, TABLE_HEIGHT * 0.75, BALL_RADIUS, {
            label: 'cueBall',
            restitution: 0.9,
            friction: 0.01,
            frictionAir: 0.02,
            render: { fillStyle: '#ffffff' }
        });
        balls.push(cueBall);
        cueBallRef.current = cueBall;

        // Triángulo básico de bolas
        let ballId = 1;
        for (let row = 0; row < 5; row++) {
            for (let i = 0; i <= row; i++) {
                const x = rackX - row * BALL_RADIUS + i * BALL_RADIUS * 2;
                const y = rackY - row * BALL_RADIUS * 1.7;
                const color = ballId === 8 ? '#000000' : '#f97316';
                balls.push(
                    Bodies.circle(x, y + row * BALL_RADIUS * 1.7, BALL_RADIUS, {
                        label: `ball-${ballId}`,
                        restitution: 0.9,
                        friction: 0.01,
                        frictionAir: 0.02,
                        render: { fillStyle: color }
                    })
                );
                ballId++;
            }
        }

        ballsRef.current = balls;
        World.add(engine.world, balls);

        Engine.run(engine);
        Render.run(render);

        engineRef.current = engine;
        renderRef.current = render;

        // Mostrar cue ball inicial
        setCueState((prev) => ({
            ...prev,
            visible: true,
            cueBall: { x: cueBall.position.x, y: cueBall.position.y }
        }));

        // Limpieza
        return () => {
            Render.stop(render);
            World.clear(engine.world, false);
            Matter.Engine.clear(engine);
            if (render.canvas) {
                render.canvas.remove();
            }
        };
    }, []);

    // Actualizar cue ball cuando cambie gameState desde el servidor (futuro)
    useEffect(() => {
        if (!gameState || !cueBallRef.current) return;
        // Aquí podríamos reposicionar bolas desde gameState al final del turno.
    }, [gameState]);

    // Helpers
    const getPointerPos = (event) => {
        const rect = sceneRef.current.getBoundingClientRect();
        if (event.touches && event.touches[0]) {
            return {
                x: event.touches[0].clientX - rect.left,
                y: event.touches[0].clientY - rect.top
            };
        }
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    };

    const updateAim = (pointer) => {
        if (!cueBallRef.current) return;
        const cx = cueBallRef.current.position.x;
        const cy = cueBallRef.current.position.y;
        const angle = Math.atan2(pointer.y - cy, pointer.x - cx);
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const dist = Math.min(MAX_DRAG_DISTANCE, Math.sqrt(dx * dx + dy * dy));
        const power = dist / MAX_DRAG_DISTANCE;
        setCueState((prev) => ({
            ...prev,
            angle,
            power,
            cueBall: { x: cx, y: cy }
        }));
    };

    const handlePointerDown = (event) => {
        if (!isMyTurn || !cueBallRef.current || isShotInProgressRef.current) return;
        if (!sceneRef.current) return;
        aimingRef.current = true;
        updateAim(getPointerPos(event));
    };

    const handlePointerMove = (event) => {
        if (!aimingRef.current) return;
        updateAim(getPointerPos(event));
    };

    const handlePointerUp = () => {
        if (!aimingRef.current || !cueBallRef.current || isShotInProgressRef.current) return;
        aimingRef.current = false;
        if (cueState.power <= 0.05) return; // tiro muy débil, ignorar

        const Body = Matter.Body;
        const angle = cueState.angle;
        const forceMagnitude = cueState.power * FORCE_SCALE;
        const force = {
            x: Math.cos(angle) * forceMagnitude,
            y: Math.sin(angle) * forceMagnitude
        };

        Body.applyForce(cueBallRef.current, cueBallRef.current.position, force);
        isShotInProgressRef.current = true;

        // Opcional: avisar al oponente para animación de taco
        if (socket && room && user) {
            socket.emit('pool:shot-event', {
                roomCode: room.code,
                force: forceMagnitude,
                angle,
                spin: 0
            });
        }

        // Cuando las bolas se detengan, podremos emitir turn-end (MVP futuro)
        setTimeout(() => {
            isShotInProgressRef.current = false;
        }, 2000);
    };

    return (
        <div className="relative flex justify-center items-center">
            <div
                ref={sceneRef}
                className="rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border-4 border-emerald-900 overflow-hidden"
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
            />

            {/* Cue Overlay */}
            {isMyTurn && cueState.visible && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <svg
                        viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`}
                        className="w-full h-full"
                    >
                        <g transform={`translate(${cueState.cueBall.x}, ${cueState.cueBall.y}) rotate(${(cueState.angle * 180) / Math.PI})`}>
                            <rect
                                x={BALL_RADIUS + 4}
                                y={-2}
                                width={80 + cueState.power * 40}
                                height={4}
                                rx={2}
                                fill="#fbbf24"
                            />
                        </g>
                    </svg>
                </div>
            )}

            {/* UI Overlay */}
            {isMyTurn && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full text-xs text-white flex items-center gap-2">
                    <span>Arrastra desde la bola blanca para apuntar</span>
                    <span className="text-amber-400 font-semibold">Potencia: {(cueState.power * 100).toFixed(0)}%</span>
                </div>
            )}
        </div>
    );
};

export default PoolGame;
