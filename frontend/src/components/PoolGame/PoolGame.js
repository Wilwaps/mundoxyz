import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

const PoolGame = ({ room, user, socket, gameState, isMyTurn }) => {
    const sceneRef = useRef(null);
    const engineRef = useRef(null);
    const renderRef = useRef(null);

    // Constants
    const TABLE_WIDTH = 800;
    const TABLE_HEIGHT = 400;
    const BALL_RADIUS = 10;

    useEffect(() => {
        if (!sceneRef.current) return;

        // 1. Setup Matter.js Engine
        const Engine = Matter.Engine,
            Render = Matter.Render,
            World = Matter.World,
            Bodies = Matter.Bodies,
            Body = Matter.Body,
            Events = Matter.Events;

        const engine = Engine.create();
        engine.world.gravity.y = 0; // Top-down view, no gravity

        const render = Render.create({
            element: sceneRef.current,
            engine: engine,
            options: {
                width: TABLE_WIDTH + 100,
                height: TABLE_HEIGHT + 100,
                wireframes: false,
                background: '#1a1a1a'
            }
        });

        // 2. Create Table Boundaries (Cushions)
        const wallOptions = { isStatic: true, render: { fillStyle: '#2e7d32' }, restitution: 0.9 };
        const walls = [
            Bodies.rectangle(TABLE_WIDTH / 2, 0, TABLE_WIDTH, 20, wallOptions), // Top
            Bodies.rectangle(TABLE_WIDTH / 2, TABLE_HEIGHT, TABLE_WIDTH, 20, wallOptions), // Bottom
            Bodies.rectangle(0, TABLE_HEIGHT / 2, 20, TABLE_HEIGHT, wallOptions), // Left
            Bodies.rectangle(TABLE_WIDTH, TABLE_HEIGHT / 2, 20, TABLE_HEIGHT, wallOptions) // Right
        ];

        World.add(engine.world, walls);

        // 3. Create Balls (Initial Rack)
        // For now, simple triangle setup
        const balls = [];
        const startX = TABLE_WIDTH * 0.75;
        const startY = TABLE_HEIGHT / 2;

        // Cue Ball
        const cueBall = Bodies.circle(TABLE_WIDTH * 0.25, TABLE_HEIGHT / 2, BALL_RADIUS, {
            label: 'cueBall',
            restitution: 0.9,
            friction: 0.005,
            frictionAir: 0.02, // Simulate felt resistance
            render: { fillStyle: '#ffffff' }
        });
        balls.push(cueBall);

        // 8-Ball Rack (Simplified for demo)
        // In real impl, use a loop for triangle positions
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j <= i; j++) {
                const x = startX + (i * BALL_RADIUS * 1.8);
                const y = startY - (i * BALL_RADIUS * 0.9) + (j * BALL_RADIUS * 1.8);
                balls.push(Bodies.circle(x, y, BALL_RADIUS, {
                    label: `ball-${i}-${j}`,
                    restitution: 0.9,
                    friction: 0.005,
                    frictionAir: 0.02,
                    render: { fillStyle: (i === 2 && j === 1) ? '#000000' : '#ff0000' } // 8-ball in middle
                }));
            }
        }

        World.add(engine.world, balls);

        // 4. Run Engine
        Engine.run(engine);
        Render.run(render);

        engineRef.current = engine;
        renderRef.current = render;

        // 5. Input Handling (Cue Stick)
        // Need to add mouse listeners for aiming

        return () => {
            Render.stop(render);
            World.clear(engine.world);
            Engine.clear(engine);
            render.canvas.remove();
            render.canvas = null;
            render.context = null;
            render.textures = {};
        };
    }, []);

    // Sync State Effect
    useEffect(() => {
        if (gameState && engineRef.current) {
            // Update ball positions from server state if needed
            // Note: For smooth physics, we usually only sync on turn end or initial load
            // Real-time sync is complex with Matter.js, usually we sync inputs
        }
    }, [gameState]);

    return (
        <div className="relative flex justify-center items-center">
            {/* Canvas Container */}
            <div ref={sceneRef} className="border-8 border-brown-800 rounded-lg shadow-2xl" />

            {/* UI Overlay for Controls */}
            {isMyTurn && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 p-4 rounded-xl backdrop-blur text-white">
                    <p className="text-center mb-2">Tu Turno - Arrastra para apuntar</p>
                    {/* Power Slider could go here */}
                </div>
            )}
        </div>
    );
};

export default PoolGame;
