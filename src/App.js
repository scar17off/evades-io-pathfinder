import React, { useRef, useEffect, useState } from 'react';
import './App.css';
import { Vector } from './utils/Vector';
import { Normal } from './entities/Normal';
import { Player } from './entities/Player';
import { findPath } from './utils/Pathfinder';

function App() {
  const canvasRef = useRef(null);
  const [config, setConfig] = useState({
    enemyCount: 10,
    playerRadius: 15,
    playerColor: '#00BFFF',
    areaWidth: 1520,
    areaHeight: 860,
    playerSpeed: 50,
    enemySpeed: 2,
    simulationSteps: 200,
    pathResolution: 30,
    safetyBuffer: 1.5,
    pathUpdateInterval: 1,
    progressiveStepSize: 120,
    lookaheadSteps: 60,
    showPredictions: true,
    showDangerZones: true,
    predictionLength: 60,
    showStats: true,
    showLegend: true,
    maxHistoryPoints: 1000,
    allowWaiting: true,
    avoidCrossingPaths: true
  });
  const [isRunning, setIsRunning] = useState(true);
  const [gameState, setGameState] = useState({
    collision: false,
    reachedGoal: false
  });
  
  const animationIdRef = useRef(null);
  const playerRef = useRef(null);
  const enemiesRef = useRef([]);
  const goalPosRef = useRef(null);
  const frameCounterRef = useRef(0);
  const statsRef = useRef({
    fps: 0,
    frameCounter: 0,
    lastFpsUpdate: 0,
    pathfindingTime: 0
  });
  const playerHistoryRef = useRef([]);

  const calculatePath = (player, goalPos, enemies) => {
    const startTime = performance.now();
    
    const simEnemies = enemies.map(e => ({
      pos: new Vector(e.pos.x, e.pos.y),
      vel: new Vector(e.vel.x, e.vel.y),
      radius: e.radius,
      speed: e.speed,
      angle: e.angle
    }));
    
    const path = findPath(
      player.pos,
      goalPos,
      simEnemies,
      {
        width: config.areaWidth,
        height: config.areaHeight,
        playerRadius: player.radius,
        playerSpeed: player.speed,
        steps: config.simulationSteps,
        resolution: config.pathResolution,
        safetyBuffer: config.safetyBuffer,
        progressiveStepSize: config.progressiveStepSize,
        lookaheadSteps: config.lookaheadSteps,
        allowWaiting: config.allowWaiting,
        avoidCrossingPaths: config.avoidCrossingPaths
      }
    );
    
    statsRef.current.pathfindingTime = performance.now() - startTime;
    
    return path;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = config.areaWidth;
    canvas.height = config.areaHeight;
    
    // Set start position (left side)
    if (!playerRef.current) {
      playerRef.current = new Player(
        new Vector(50, config.areaHeight/2),
        config.playerRadius,
        config.playerColor
      );
      // Reset player history
      playerHistoryRef.current = [new Vector(50, config.areaHeight/2)];
    }
    const player = playerRef.current;
    player.speed = config.playerSpeed;
    player.allowWaiting = config.allowWaiting;

    // Set goal position (right side)
    if (!goalPosRef.current) {
      goalPosRef.current = new Vector(config.areaWidth - 50, config.areaHeight/2);
    }
    const goalPos = goalPosRef.current;

    // Create enemies
    if (enemiesRef.current.length !== config.enemyCount) {
      enemiesRef.current = [];
      for (let i = 0; i < config.enemyCount; i++) {
        const pos = new Vector(
          Math.random() * config.areaWidth,
          Math.random() * config.areaHeight
        );
        // Ensure enemies aren't too close to start or goal
        const distToStart = Math.hypot(pos.x - player.pos.x, pos.y - player.pos.y);
        const distToGoal = Math.hypot(pos.x - goalPos.x, pos.y - goalPos.y);
        
        if (distToStart > 100 && distToGoal > 100) {
          const radius = 10 + Math.random() * 15;
          const speed = config.enemySpeed * (0.8 + Math.random() * 0.4);
          
          enemiesRef.current.push(new Normal(pos, radius, speed));
        } else {
          i--; // Try again for this enemy (maybe it's a stupid way to do this)
        }
      }
    } else {
      // Update existing enemies with new speed
      enemiesRef.current.forEach(enemy => {
        enemy.speed = config.enemySpeed * (0.8 + Math.random() * 0.4);
      });
    }
    const enemies = enemiesRef.current;
    
    // Initial path calculation
    const path = calculatePath(player, goalPos, enemies);
    player.setPath(path);
    
    frameCounterRef.current = 0;
    
    // Predict enemy paths for visualization
    const predictEnemyPaths = () => {
      const predictions = [];
      for (const enemy of enemies) {
        const path = [];
        const simEnemy = {
          pos: new Vector(enemy.pos.x, enemy.pos.y),
          vel: new Vector(enemy.vel.x, enemy.vel.y),
          radius: enemy.radius,
          angle: enemy.angle,
          speed: enemy.speed
        };
        
        for (let i = 0; i < config.predictionLength; i++) {
          path.push(new Vector(simEnemy.pos.x, simEnemy.pos.y));
          
          simEnemy.pos.x += simEnemy.vel.x / 32;
          simEnemy.pos.y += simEnemy.vel.y / 32;
          
          if (simEnemy.pos.x - simEnemy.radius < 0) {
            simEnemy.pos.x = simEnemy.radius;
            simEnemy.vel.x = Math.abs(simEnemy.vel.x);
          } else if (simEnemy.pos.x + simEnemy.radius > config.areaWidth) {
            simEnemy.pos.x = config.areaWidth - simEnemy.radius;
            simEnemy.vel.x = -Math.abs(simEnemy.vel.x);
          }
          
          if (simEnemy.pos.y - simEnemy.radius < 0) {
            simEnemy.pos.y = simEnemy.radius;
            simEnemy.vel.y = Math.abs(simEnemy.vel.y);
          } else if (simEnemy.pos.y + simEnemy.radius > config.areaHeight) {
            simEnemy.pos.y = config.areaHeight - simEnemy.radius;
            simEnemy.vel.y = -Math.abs(simEnemy.vel.y);
          }
        }
        
        predictions.push(path);
      }
      
      return predictions;
    };
    
    // Game loop
    let lastTime = 0;
    let reachedGoal = gameState.reachedGoal;
    let lastPlayerPos = new Vector(player.pos.x, player.pos.y);
    
    function gameLoop(timestamp) {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = isRunning ? timestamp - lastTime : 0;
      lastTime = timestamp;
      
      // Update FPS counter
      statsRef.current.frameCounter++;
      if (timestamp - statsRef.current.lastFpsUpdate > 1000) {
        statsRef.current.fps = Math.round(statsRef.current.frameCounter * 1000 / (timestamp - statsRef.current.lastFpsUpdate));
        statsRef.current.frameCounter = 0;
        statsRef.current.lastFpsUpdate = timestamp;
      }
      
      frameCounterRef.current++;
      
      // Clear canvas
      ctx.fillStyle = '#F0F0F0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid
      ctx.strokeStyle = '#E0E0E0';
      ctx.lineWidth = 1;
      const gridSize = 50;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Draw goal
      ctx.beginPath();
      ctx.arc(goalPos.x, goalPos.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = '#00FF00';
      ctx.fill();
      ctx.strokeStyle = '#008800';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Predict enemy paths
      let enemyPredictions = [];
      if (config.showPredictions) {
        enemyPredictions = predictEnemyPaths();
      }
      
      // Update entities first to get their new positions
      if (isRunning) {
        // Update enemies
        for (const enemy of enemies) {
          enemy.update(deltaTime);
          enemy.collide({ width: config.areaWidth, height: config.areaHeight });
        }
        
        // Update path every frame when running
        if (!reachedGoal && frameCounterRef.current % config.pathUpdateInterval === 0) {
          const newPath = calculatePath(player, goalPos, enemies);
          player.setPath(newPath);
        }
        
        // Update player after path has been recalculated
        if (!reachedGoal) {
          player.allowWaiting = config.allowWaiting;
          
          player.update(deltaTime);
          player.collide({ width: config.areaWidth, height: config.areaHeight });
          
          // This makes it less laggy I think
          const movedDistance = Math.hypot(player.pos.x - lastPlayerPos.x, player.pos.y - lastPlayerPos.y);
          if (movedDistance > 1) {
            playerHistoryRef.current.push(new Vector(player.pos.x, player.pos.y));
            // Limit history size
            if (playerHistoryRef.current.length > config.maxHistoryPoints) {
              playerHistoryRef.current.shift();
            }
            lastPlayerPos = new Vector(player.pos.x, player.pos.y);
          }
          
          // Check if player reached goal
          const dx = player.pos.x - goalPos.x;
          const dy = player.pos.y - goalPos.y;
          if (Math.sqrt(dx * dx + dy * dy) < 20 + player.radius) {
            reachedGoal = true;
            player.speed = 0;
            setGameState(prev => ({ ...prev, reachedGoal: true }));
          }
        }
      }
      
      // Draw player's historical path
      if (playerHistoryRef.current.length > 1) {
        ctx.beginPath();
        ctx.moveTo(playerHistoryRef.current[0].x, playerHistoryRef.current[0].y);
        
        for (let i = 1; i < playerHistoryRef.current.length; i++) {
          ctx.lineTo(playerHistoryRef.current[i].x, playerHistoryRef.current[i].y);
        }
        
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)'; // Orange
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      // Draw danger zones if enabled
      if (config.showDangerZones) {
        for (let i = 0; i < enemies.length; i++) {
          const enemy = enemies[i];
          const dangerRadius = (enemy.radius + player.radius) * config.safetyBuffer;
          
          // Draw danger zone
          ctx.beginPath();
          ctx.arc(enemy.pos.x, enemy.pos.y, dangerRadius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
          ctx.fill();
          
          if (config.avoidCrossingPaths && config.showPredictions) {
            const prediction = enemyPredictions[i];
            if (prediction && prediction.length > 0) {
              ctx.beginPath();
              ctx.moveTo(enemy.pos.x, enemy.pos.y);
              
              for (let p = 0; p < prediction.length; p++) {
                const point = prediction[p];
                const radius = (enemy.radius + player.radius) * (config.safetyBuffer * 0.5);
                
                ctx.lineTo(point.x, point.y);
                
                // Draw fading danger zones along the path
                if (p % 10 === 0) {
                  const opacity = 0.1 * (1 - p / prediction.length);
                  ctx.save();
                  ctx.beginPath();
                  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
                  ctx.fillStyle = `rgba(255, 0, 0, ${opacity})`;
                  ctx.fill();
                  ctx.restore();
                }
              }
            }
          }
        }
      }
      
      // Draw predicted enemy paths if enabled
      if (config.showPredictions) {
        for (let i = 0; i < enemies.length; i++) {
          const enemy = enemies[i];
          const prediction = enemyPredictions[i];
          
          // Draw prediction line
          if (prediction && prediction.length > 0) {
            ctx.beginPath();
            ctx.moveTo(enemy.pos.x, enemy.pos.y);
            
            for (const point of prediction) {
              ctx.lineTo(point.x, point.y);
            }
            
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      
      // Check collisions and render enemies
      for (const enemy of enemies) {
        // Check player collision with enemy
        if (!reachedGoal && isRunning) {
          const dx = player.pos.x - enemy.pos.x;
          const dy = player.pos.y - enemy.pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < player.radius + enemy.radius) {
            let collision = true;
            setGameState(prev => ({ ...prev, collision: true }));
            setIsRunning(false);
          }
        }
        
        // Render enemy
        ctx.beginPath();
        ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius, 0, Math.PI * 2);
        ctx.fillStyle = enemy.color;
        ctx.fill();
        if (enemy.outline) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      
      // Draw predicted path with color gradient
      if (player.path.length > 0 && !reachedGoal) {
        if (player.path.length > 0) {
          let prevPoint = player.pos;
          
          for (let i = 0; i < player.path.length; i++) {
            const point = player.path[i];
            const progress = i / (player.path.length);
            
            // Check if this is a waiting point (same position as previous)
            const isWaitingPoint = i > 0 && 
              Math.abs(point.x - player.path[i-1].x) < 0.1 && 
              Math.abs(point.y - player.path[i-1].y) < 0.1;
            
            if (isWaitingPoint && config.allowWaiting) {
              // Draw a special marker for waiting points
              ctx.beginPath();
              ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(255, 255, 0, 0.7)'; // Yellow
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.moveTo(prevPoint.x, prevPoint.y);
              ctx.lineTo(point.x, point.y);
              
              // Gradient from blue to green (not sure if this works)
              const r = Math.floor(0 + progress * 0);
              const g = Math.floor(100 + progress * 155);
              const b = Math.floor(255 - progress * 155);
              
              ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
              ctx.lineWidth = 3;
              ctx.stroke();
            }
            
            prevPoint = point;
          }
          
          // Final segment to goal
          ctx.beginPath();
          ctx.moveTo(prevPoint.x, prevPoint.y);
          ctx.lineTo(goalPos.x, goalPos.y);
          ctx.strokeStyle = 'rgba(0, 200, 0, 0.7)';
          ctx.stroke();
        }
        
        // Draw waypoints
        for (let i = 0; i < player.path.length; i++) {
          const point = player.path[i];
          const progress = i / (player.path.length);
          
          // Check if this is a waiting point
          const isWaitingPoint = i > 0 && 
            Math.abs(point.x - player.path[i-1].x) < 0.1 && 
            Math.abs(point.y - player.path[i-1].y) < 0.1;
          
          if (isWaitingPoint && config.allowWaiting) {
            // Already drawn above bro
          } else {
            // Color gradient for waypoints
            const r = Math.floor(0 + progress * 0);
            const g = Math.floor(100 + progress * 155);
            const b = Math.floor(255 - progress * 155);
            
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fill();
          }
        }
      }
      
      // Render player
      ctx.beginPath();
      ctx.arc(player.pos.x, player.pos.y, player.radius, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      if (player.outline) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Draw direction indicator
      if (!reachedGoal) {
        const dirLength = player.radius * 1.5;
        const endX = player.pos.x + Math.cos(player.angle) * dirLength;
        const endY = player.pos.y + Math.sin(player.angle) * dirLength;
        
        ctx.beginPath();
        ctx.moveTo(player.pos.x, player.pos.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      // If player is waiting, show a visual indicator
      if (player.isWaiting && config.allowWaiting) {
        ctx.beginPath();
        ctx.arc(player.pos.x, player.pos.y, player.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Display status and stats
      ctx.font = '16px Arial';
      ctx.fillStyle = 'black';
      
      if (gameState.collision) {
        ctx.fillStyle = 'red';
        ctx.fillText('Collision Detected! Simulation Paused.', 20, 30);
      } else if (gameState.reachedGoal) {
        ctx.fillStyle = 'green';
        ctx.fillText('Goal Reached!', 20, 30);
      } else if (!isRunning) {
        ctx.fillText('Simulation Paused', 20, 30);
      }
      
      // Display performance stats if enabled
      if (config.showStats) {
        const textY = config.areaHeight - 80;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, textY - 20, 250, 80);
        ctx.fillStyle = 'white';
        
        ctx.fillText(`FPS: ${statsRef.current.fps}`, 20, textY);
        ctx.fillText(`Pathfinding time: ${statsRef.current.pathfindingTime.toFixed(2)}ms`, 20, textY + 20);
        ctx.fillText(`Enemies: ${enemies.length}`, 20, textY + 40);
        ctx.fillText(`Path waypoints: ${player.path.length}`, 20, textY + 60);
      }
      
      // Draw legend if enabled
      if (config.showLegend) {
        const legendY = 60;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, legendY - 20, 220, 100);
        
        // Historical path legend
        ctx.beginPath();
        ctx.moveTo(20, legendY);
        ctx.lineTo(60, legendY);
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.fillText('Historical Path', 70, legendY + 5);
        
        // Predicted path legend
        ctx.beginPath();
        ctx.moveTo(20, legendY + 25);
        ctx.lineTo(60, legendY + 25);
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.7)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.fillText('Predicted Path', 70, legendY + 30);
        
        // Enemy prediction legend
        ctx.beginPath();
        ctx.moveTo(20, legendY + 50);
        ctx.lineTo(60, legendY + 50);
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.fillText('Enemy Prediction', 70, legendY + 55);
        
        // Waiting point legend
        if (config.allowWaiting) {
          ctx.beginPath();
          ctx.arc(40, legendY + 75, 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
          ctx.fill();
          ctx.fillStyle = 'white';
          ctx.fillText('Waiting Point', 70, legendY + 80);
        }
      }
      
      animationIdRef.current = requestAnimationFrame(gameLoop);
    }
    
    animationIdRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [config, isRunning, gameState]);

  const resetSimulation = () => {
    // Reset player position
    if (playerRef.current) {
      playerRef.current.pos.x = 50;
      playerRef.current.pos.y = config.areaHeight/2;
      playerRef.current.path = [];
    }
    
    // Reset player history
    playerHistoryRef.current = [new Vector(50, config.areaHeight/2)];
    
    // Reset enemies (generate new ones)
    enemiesRef.current = [];
    
    // Reset game state
    setGameState({
      collision: false,
      reachedGoal: false
    });
    
    setIsRunning(true);
  };

  return (
    <div className="App">
      <div className="controls">
        <label>
          Enemies:
          <input 
            type="number" 
            value={config.enemyCount}
            onChange={(e) => setConfig({...config, enemyCount: parseInt(e.target.value) || 0})}
            min="0"
            max="1000"
          />
        </label>
        
        <label>
          Player Speed:
          <input
            type="range"
            min="1"
            max="400"
            value={config.playerSpeed}
            onChange={(e) => setConfig({...config, playerSpeed: parseFloat(e.target.value)})}
          />
          <span>{config.playerSpeed}</span>
        </label>
        
        <label>
          Enemy Speed:
          <input
            type="range"
            min="0.5"
            max="400"
            step="0.5"
            value={config.enemySpeed}
            onChange={(e) => setConfig({...config, enemySpeed: parseFloat(e.target.value)})}
          />
          <span>{config.enemySpeed}</span>
        </label>
        
        <label>
          Safety Buffer:
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={config.safetyBuffer}
            onChange={(e) => setConfig({...config, safetyBuffer: parseFloat(e.target.value)})}
          />
          <span>{config.safetyBuffer.toFixed(1)}x</span>
        </label>
        
        <label>
          Step Size:
          <input
            type="range"
            min="50"
            max="300"
            step="10"
            value={config.progressiveStepSize}
            onChange={(e) => setConfig({...config, progressiveStepSize: parseInt(e.target.value)})}
          />
          <span>{config.progressiveStepSize}</span>
        </label>
        
        <div className="visualization-controls">
          <label>
            <input
              type="checkbox"
              checked={config.showPredictions}
              onChange={(e) => setConfig({...config, showPredictions: e.target.checked})}
            />
            Show Predictions
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={config.showDangerZones}
              onChange={(e) => setConfig({...config, showDangerZones: e.target.checked})}
            />
            Show Danger Zones
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={config.showStats}
              onChange={(e) => setConfig({...config, showStats: e.target.checked})}
            />
            Show Stats
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={config.showLegend}
              onChange={(e) => setConfig({...config, showLegend: e.target.checked})}
            />
            Show Legend
          </label>
        </div>
        
        <div className="pathfinding-controls">
          <label>
            <input
              type="checkbox"
              checked={config.allowWaiting}
              onChange={(e) => setConfig({...config, allowWaiting: e.target.checked})}
            />
            Allow Waiting
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={config.avoidCrossingPaths}
              onChange={(e) => setConfig({...config, avoidCrossingPaths: e.target.checked})}
            />
            Avoid Crossing Paths
          </label>
        </div>
        
        <div className="simulation-controls">
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={isRunning ? "pause-btn" : "play-btn"}
          >
            {isRunning ? "Pause" : "Resume"}
          </button>
          
          <button 
            onClick={resetSimulation}
            className="reset-btn"
          >
            Reset
          </button>
        </div>
      </div>
      
      <canvas ref={canvasRef} />
    </div>
  );
}

export default App;