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

    const [showTutorial, setShowTutorial] = useState(true);

    // Mesa vertical pensada para móvil / Telegram
    const TABLE_WIDTH = 380;
    const TABLE_HEIGHT = 720;
    const BALL_RADIUS = 10;
    const MAX_DRAG_DISTANCE = 140;
    const FORCE_SCALE = 0.02; // Increased force for better impact

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

    // Tutorial Timer
    useEffect(() => {
        if (isMyTurn && showTutorial) {
            const timer = setTimeout(() => {
                setShowTutorial(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isMyTurn, showTutorial]);

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

        // Invert force to shoot in opposite direction of drag (slingshot mechanic)
        const force = {
            x: -Math.cos(angle) * forceMagnitude,
            y: -Math.sin(angle) * forceMagnitude
        };

        Body.applyForce(cueBallRef.current, cueBallRef.current.position, force);
        isShotInProgressRef.current = true;

        // Hide tutorial immediately on shot
        setShowTutorial(false);

        // Reset power visual
        setCueState(prev => ({ ...prev, power: 0 }));

        // Opcional: avisar al oponente para animación de taco
        if (socket && room && user) {
            socket.emit('pool:shot-event', {
                roomCode: room.code,
                force: forceMagnitude,
                angle: angle + Math.PI, // Send actual shot angle
                spin: 0
            });
        }

        // Cuando las bolas se detengan, podremos emitir turn-end (MVP futuro)
        setTimeout(() => {
            isShotInProgressRef.current = false;
        }, 2000);
    };

    // Global event listeners for release
    useEffect(() => {
        window.addEventListener('mouseup', handlePointerUp);
        window.addEventListener('touchend', handlePointerUp);
        return () => {
            window.removeEventListener('mouseup', handlePointerUp);
            window.removeEventListener('touchend', handlePointerUp);
        };
    }, [cueState.power, cueState.angle]); // Re-bind to capture latest state

    return (
        <div className="relative flex justify-center items-center">
            <div
                ref={sceneRef}
                className="rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border-4 border-emerald-900 overflow-hidden touch-none"
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
            />

            {/* Cue Overlay */}
            {isMyTurn && cueState.visible && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <svg
                        viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`}
                        className="w-full h-full"
                    >
                        <g transform={`translate(${cueState.cueBall.x}, ${cueState.cueBall.y}) rotate(${(cueState.angle * 180) / Math.PI})`}>
                            {/* Stick (Visual only) */}
                            <rect
                                x={BALL_RADIUS + 4}
                                y={-2}
                                width={80 + cueState.power * 40}
                                height={4}
                                rx={2}
                                fill="#fbbf24"
                            />
                            {/* Aim Line (Optional) */}
                            {aimingRef.current && (
                                <line
                                    x1={-BALL_RADIUS}
                                    y1={0}
                                    x2={-100}
                                    y2={0}
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth="1"
                                    strokeDasharray="4"
                                />
                            )}
                        </g>
                    </svg>
                </div>
            )}

            {/* UI Overlay */}
            {isMyTurn && (
                <>
                    {/* Tutorial Toast */}
                    {showTutorial && (
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 px-6 py-3 rounded-xl text-sm text-white text-center backdrop-blur-md border border-white/10 shadow-xl z-10 animate-bounce">
                            <p className="font-bold text-accent mb-1">¡Tu Turno!</p>
                            <p>Arrastra hacia atrás para potenciar y suelta para disparar.</p>
                        </div>
                    )}

                    {/* Power Meter (Only when aiming) */}
                    {aimingRef.current && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full text-xs text-white flex items-center gap-2 pointer-events-none">
                            <span>Potencia</span>
                            <div className="w-20 h-2 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-green-500 to-red-500"
                                    style={{ width: `${cueState.power * 100}%` }}
                                />
                            </div>
                            <span className="font-mono">{(cueState.power * 100).toFixed(0)}%</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PoolGame;
