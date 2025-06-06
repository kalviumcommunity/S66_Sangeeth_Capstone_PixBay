import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import io, { Socket } from "socket.io-client";
import api from "../utils/api";
import { Pencil, Eraser, Undo, Trash } from "lucide-react"; // Changed Redo to Trash to match clear function

interface WhiteBoardProps {
  roomCode: string;
  userId: string;
}

type DrawingAction = {
  type: "start" | "draw" | "clear";
  x?: number;
  y?: number;
  color?: string;
  brushSize?: number;
  tool?: string;
  pressure?: number;
  timestamp?: number;
  points?: Point[]; // Added points array for smooth curves
};

type Point = { x: number; y: number; pressure?: number };
type SmoothingConfig = {
  factor: number;
  points: number;
  velocityWeight: number;
  bezierControlPoints?: number; // Optional control points for Bezier curves
};

const SMOOTHING_CONFIG: SmoothingConfig = {
  factor: 0.35,
  points: 12, // Increased from 8 for smoother curves
  velocityWeight: 0.6, // Slightly reduced to make lines more consistent
  bezierControlPoints: 0.25, // Control point factor for Bezier curves
};

// Batch processing configuration
const BATCH_CONFIG = {
  size: 10,
  interval: 50, // ms
};

const WhiteBoard: React.FC<WhiteBoardProps> = ({ roomCode, userId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#D3D3D3");
  const [brushSize, setBrushSize] = useState(5);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [tool, setTool] = useState("pen");
  const [prevActions, setPrevActions] = useState<DrawingAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prevSmoothedPoint = useRef<{ x: number; y: number } | null>(null);
  const actionsRef = useRef<DrawingAction[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawingPathRef = useRef<{ x: number; y: number }[]>([]);
  const actionBatchRef = useRef<DrawingAction[]>([]);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const smoothedPoints = useRef<Point[]>([]);
  const lastVelocity = useRef<number>(0);
  const lastTimestamp = useRef<number>(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  const smoothStroke = (points: Point[]): Point[] => {
    if (points.length < 2) return points;

    // Enhanced smoothing algorithm using higher quality Bezier curves
    const smoothed: Point[] = [];

    // Start with the first point
    smoothed.push({
      x: points[0].x,
      y: points[0].y,
      pressure: points[0].pressure || 1,
    });

    // Use Catmull-Rom spline to create smoother curves
    for (let i = 1; i < points.length - 2; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i + 2 < points.length ? points[i + 2] : p2;

      // Generate more points for smoother curves
      for (let t = 0; t < 1; t += 0.1) {
        const t2 = t * t;
        const t3 = t2 * t;

        // Catmull-Rom spline formula
        const x =
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

        const y =
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

        // Interpolate pressure for smooth line width transitions
        const pressure = p1.pressure || 1;

        smoothed.push({ x, y, pressure });
      }
    }

    // Add the last point
    if (points.length > 1) {
      smoothed.push({
        x: points[points.length - 1].x,
        y: points[points.length - 1].y,
        pressure: points[points.length - 1].pressure || 1,
      });
    }

    return smoothed;
  };

  const calculatePressure = (x: number, y: number): number => {
    const now = Date.now();
    const timeDelta = now - lastTimestamp.current;
    lastTimestamp.current = now;

    if (!lastPointRef.current) return 1;

    const dx = x - lastPointRef.current.x;
    const dy = y - lastPointRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Improved velocity calculation with damping
    const velocity = timeDelta > 0 ? distance / timeDelta : 0;

    // More stable velocity tracking with weighted averaging
    lastVelocity.current = lastVelocity.current * 0.6 + velocity * 0.4;

    // Enhanced pressure mapping for more natural feel
    // Map velocity to pressure with a non-linear curve for better control
    const pressureFromVelocity = Math.max(
      0.3, // Minimum pressure
      Math.min(
        1,
        1 -
          Math.pow(lastVelocity.current * SMOOTHING_CONFIG.velocityWeight, 0.7),
      ),
    );

    return pressureFromVelocity;
  };

  // Initialize canvas and socket with enhanced error handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const initCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    initCanvas();

    const setupSocket = () => {
      const newSocket = io(api.getApiUrl(), {
        path: "/socket.io",
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        query: { roomCode, userId },
        timeout: 20000,
      });

      let isReconnecting = false;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;

      const handleReconnectError = (err: Error) => {
        reconnectAttempts++;
        if (reconnectAttempts >= maxReconnectAttempts && isMountedRef.current) {
          setError(
            `Connection failed after ${maxReconnectAttempts} attempts: ${err.message}. Please refresh.`,
          );
        }
      };

      newSocket.on("reconnect_error", handleReconnectError); // Added this line to use the function

      newSocket.on("connect", () => {
        reconnectAttempts = 0;
        console.log("Whiteboard connected:", newSocket.id);
        newSocket.emit("join-whiteboard", roomCode);

        if (isReconnecting) {
          console.log("Requesting whiteboard history after reconnection");
          newSocket.emit("get-whiteboard-history", roomCode);
          isReconnecting = false;
        }
      });

      newSocket.on("connect_error", (err) => {
        console.error("Connection error:", err);
        if (isMountedRef.current) {
          setError(`Connection error: ${err.message}`);
        }
      });

      newSocket.on("disconnect", (reason) => {
        console.log("Whiteboard disconnected:", reason);
        if (reason === "io server disconnect") {
          // Manual reconnection needed
          setTimeout(() => {
            newSocket.connect();
          }, 1000);
        }
        isReconnecting = true;
      });

      newSocket.on("error", (err) => {
        console.error("Socket error:", err);
        if (isMountedRef.current) {
          setError(`Socket error: ${err.message}`);
        }
      });

      newSocket.on("whiteboard-history", (history) => {
        console.log("Received whiteboard history:", history);
        if (Array.isArray(history) && history.length > 0) {
          setPrevActions(history);
          actionsRef.current = history;
          requestAnimationFrame(() => redrawCanvas(history));
        }
      });

      newSocket.on("whiteboard-action", (action: DrawingAction) => {
        handleRemoteAction(action);
        actionsRef.current.push(action);
        setPrevActions([...actionsRef.current]);
      });

      newSocket.on("whiteboard-batch", (batch: DrawingAction[]) => {
        batch.forEach((action) => handleRemoteAction(action));
        actionsRef.current.push(...batch);
        setPrevActions([...actionsRef.current]);
      });

      return newSocket;
    };

    const newSocket = setupSocket();
    setSocket(newSocket);

    return () => {
      if (newSocket.connected) {
        newSocket.disconnect();
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, [roomCode, userId]);

  useEffect(() => {
    const handleLayoutChange = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          const prevWidth = canvasRef.current.width;
          const prevHeight = canvasRef.current.height;

          canvasRef.current.width = container.clientWidth;
          canvasRef.current.height = container.clientHeight;

          console.log(
            `Canvas resized from ${prevWidth}x${prevHeight} to ${canvasRef.current.width}x${canvasRef.current.height}`,
          );
          console.log(`Redrawing ${actionsRef.current.length} actions`);

          redrawCanvas(actionsRef.current);
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleLayoutChange();
    });

    if (canvasContainerRef.current) {
      resizeObserver.observe(canvasContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Enhanced redrawCanvas to maintain high quality when loading history
  const redrawCanvas = (actions = prevActions) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Start with a clean canvas
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Track current drawing state
    let lastTool = "pen";
    let lastColor = "#000000";
    let lastSize = 5;

    // Process all actions with high-quality rendering
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      if (action.type === "clear") {
        ctx.fillStyle = "#121212";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        continue;
      }

      if (action.type === "start") {
        ctx.beginPath();
        ctx.moveTo(action.x || 0, action.y || 0);
        lastTool = action.tool || lastTool;
        lastColor = action.color || lastColor;
        lastSize = action.brushSize || lastSize;

        ctx.strokeStyle = lastColor;
        ctx.lineWidth = lastSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation =
          lastTool === "eraser" ? "destination-out" : "source-over";
        continue;
      }

      if (action.type === "draw") {
        ctx.strokeStyle = action.color || lastColor;

        // Use high-quality rendering with points if available
        if (action.points && action.points.length > 0) {
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.globalCompositeOperation =
            action.tool === "eraser" ? "destination-out" : "source-over";

          ctx.beginPath();
          ctx.moveTo(action.points[0].x, action.points[0].y);

          for (let j = 1; j < action.points.length - 2; j++) {
            const p1 = action.points[j];
            const p2 = action.points[j + 1];

            const xc = (p1.x + p2.x) / 2;
            const yc = (p1.y + p2.y) / 2;

            const width = (action.brushSize || lastSize) * (p1.pressure || 1);
            ctx.lineWidth = width;

            ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(xc, yc);
          }

          // Draw last segment
          if (action.points.length > 2) {
            const last = action.points.length - 1;
            const secondLast = action.points.length - 2;

            ctx.lineWidth =
              (action.brushSize || lastSize) *
              (action.points[secondLast].pressure || 1);
            ctx.quadraticCurveTo(
              action.points[secondLast].x,
              action.points[secondLast].y,
              action.points[last].x,
              action.points[last].y,
            );
            ctx.stroke();
          }

          ctx.restore();
        } else {
          // Fallback to simpler drawing if no points
          ctx.lineWidth =
            (action.brushSize || lastSize) * (action.pressure || 1);
          ctx.lineTo(action.x || 0, action.y || 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(action.x || 0, action.y || 0);
        }

        lastColor = action.color || lastColor;
        lastSize = action.brushSize || lastSize;
      }
    }
  };

  const handleRemoteAction = (action: DrawingAction) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (action.type === "clear") {
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (action.type === "start") {
      ctx.beginPath();
      ctx.moveTo(action.x || 0, action.y || 0);
      ctx.strokeStyle = action.color || "#000000";
      ctx.lineWidth = action.brushSize || 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation =
        action.tool === "eraser" ? "destination-out" : "source-over";
    } else if (action.type === "draw") {
      ctx.strokeStyle = action.color || ctx.strokeStyle;

      // High quality remote drawing with smoothed points
      if (action.points && action.points.length > 0) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation =
          action.tool === "eraser" ? "destination-out" : "source-over";

        ctx.beginPath();
        ctx.moveTo(action.points[0].x, action.points[0].y);

        for (let i = 1; i < action.points.length - 2; i++) {
          const p1 = action.points[i];
          const p2 = action.points[i + 1];

          const xc = (p1.x + p2.x) / 2;
          const yc = (p1.y + p2.y) / 2;

          // Ensure consistent line width
          const width = (action.brushSize || 5) * (p1.pressure || 1);
          ctx.lineWidth = width;

          ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(xc, yc);
        }

        // Draw last segment
        if (action.points.length > 2) {
          const last = action.points.length - 1;
          const secondLast = action.points.length - 2;

          ctx.lineWidth =
            (action.brushSize || 5) * (action.points[secondLast].pressure || 1);
          ctx.quadraticCurveTo(
            action.points[secondLast].x,
            action.points[secondLast].y,
            action.points[last].x,
            action.points[last].y,
          );
          ctx.stroke();
        }

        ctx.restore();
      } else {
        // Fallback to original behavior if no points array
        ctx.lineWidth = (action.brushSize || 5) * (action.pressure || 1);
        ctx.lineTo(action.x || 0, action.y || 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(action.x || 0, action.y || 0);
      }
    }
  };

  const getMouseCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    return { x, y };
  };

  const flushActionBatch = () => {
    if (actionBatchRef.current.length > 0 && socket) {
      socket.emit("whiteboard-batch", {
        roomCode,
        actions: actionBatchRef.current,
      });
      actionBatchRef.current = [];
    }
    batchTimerRef.current = null;
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !socket) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getMouseCoordinates(e);
    prevSmoothedPoint.current = { x, y };

    const action: DrawingAction = {
      type: "start",
      x,
      y,
      color: tool === "eraser" ? "#121212" : color,
      brushSize,
      tool,
      timestamp: Date.now(),
    };

    // Add to batch and send immediately for start actions
    actionBatchRef.current.push(action);
    flushActionBatch();

    const newActions = [...actionsRef.current, action];
    setPrevActions(newActions);
    actionsRef.current = newActions;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = tool === "eraser" ? "#121212" : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setIsDrawing(true);

    drawingPathRef.current = [{ x, y }];
    lastPointRef.current = { x, y };

    smoothedPoints.current = [];
    lastVelocity.current = 0;
    lastTimestamp.current = Date.now();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !socket) return;

    const { x, y } = getMouseCoordinates(e);
    const pressure = calculatePressure(x, y);

    smoothedPoints.current.push({ x, y, pressure });

    if (smoothedPoints.current.length > SMOOTHING_CONFIG.points) {
      smoothedPoints.current.shift();
    }

    const smoothed = smoothStroke(smoothedPoints.current);

    const touchCanvas = canvasRef.current;
    if (!touchCanvas) return;

    const ctx = touchCanvas.getContext("2d");
    if (!ctx) return;

    if (smoothed.length > 0) {
      // High quality rendering with proper antialiasing
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation =
        tool === "eraser" ? "destination-out" : "source-over";

      ctx.beginPath();
      ctx.moveTo(smoothed[0].x, smoothed[0].y);

      // Use cubic Bezier curves for smoother drawing
      for (let i = 1; i < smoothed.length - 2; i++) {
        const p1 = smoothed[i];
        const p2 = smoothed[i + 1];

        const xc = (p1.x + p2.x) / 2;
        const yc = (p1.y + p2.y) / 2;

        // Enhanced line width handling with pressure
        const width = brushSize * (p1.pressure || 1);
        ctx.lineWidth = width;

        // Use bezier curve for smoother lines
        ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
        ctx.stroke();

        // Start new sub-path to handle varying line widths
        ctx.beginPath();
        ctx.moveTo(xc, yc);
      }

      // Draw last segment
      if (smoothed.length > 2) {
        const last = smoothed.length - 1;
        const secondLast = smoothed.length - 2;

        ctx.lineWidth = brushSize * (smoothed[secondLast].pressure || 1);
        ctx.quadraticCurveTo(
          smoothed[secondLast].x,
          smoothed[secondLast].y,
          smoothed[last].x,
          smoothed[last].y,
        );
        ctx.stroke();
      }

      ctx.restore();
    }

    // Add to batch with complete smoothed points for high quality remote rendering
    actionBatchRef.current.push({
      type: "draw",
      x,
      y,
      pressure,
      color: tool === "eraser" ? "#121212" : color,
      brushSize,
      tool,
      timestamp: Date.now(),
      points: smoothed,
    });

    // Start batch timer if not already running
    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(
        flushActionBatch,
        BATCH_CONFIG.interval,
      );
    }

    // Flush if batch size exceeds limit
    if (actionBatchRef.current.length >= BATCH_CONFIG.size) {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
      flushActionBatch();
    }

    lastPointRef.current = { x, y };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;

    // Flush any remaining actions
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      flushActionBatch();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !socket) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const action: DrawingAction = {
      type: "clear",
      timestamp: Date.now(),
    };

    // Send clear action immediately
    socket.emit("whiteboard-action", { roomCode, action });

    const newActions = [...actionsRef.current, action];
    setPrevActions(newActions);
    actionsRef.current = newActions;

    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const undoLastAction = () => {
    if (actionsRef.current.length === 0) return;

    const newActions = [...actionsRef.current];
    newActions.pop();
    setPrevActions(newActions);
    actionsRef.current = newActions;
    redrawCanvas(newActions);

    if (socket) {
      socket.emit("whiteboard-undo", { roomCode });
    }
  };

  // Add touch event handling for mobile support
  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    if (!canvas || !socket) return;

    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Rest of the logic identical to startDrawing
    prevSmoothedPoint.current = { x, y };

    const action: DrawingAction = {
      type: "start",
      x,
      y,
      color: tool === "eraser" ? "#121212" : color,
      brushSize,
      tool,
      timestamp: Date.now(),
    };

    // Add to batch and send immediately for start actions
    actionBatchRef.current.push(action);
    flushActionBatch();

    const newActions = [...actionsRef.current, action];
    setPrevActions(newActions);
    actionsRef.current = newActions;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = tool === "eraser" ? "#121212" : color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    setIsDrawing(true);

    drawingPathRef.current = [{ x, y }];
    lastPointRef.current = { x, y };

    smoothedPoints.current = [];
    lastVelocity.current = 0;
    lastTimestamp.current = Date.now();
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !socket) return;

    const touch = e.touches[0];
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Rest identical to draw function
    const pressure = calculatePressure(x, y);

    smoothedPoints.current.push({ x, y, pressure });

    if (smoothedPoints.current.length > SMOOTHING_CONFIG.points) {
      smoothedPoints.current.shift();
    }

    const smoothed = smoothStroke(smoothedPoints.current);

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    if (smoothed.length > 0) {
      // High quality rendering with proper antialiasing
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation =
        tool === "eraser" ? "destination-out" : "source-over";

      ctx.beginPath();
      ctx.moveTo(smoothed[0].x, smoothed[0].y);

      // Use cubic Bezier curves for smoother drawing
      for (let i = 1; i < smoothed.length - 2; i++) {
        const p1 = smoothed[i];
        const p2 = smoothed[i + 1];

        const xc = (p1.x + p2.x) / 2;
        const yc = (p1.y + p2.y) / 2;

        // Enhanced line width handling with pressure
        const width = brushSize * (p1.pressure || 1);
        ctx.lineWidth = width;

        // Use bezier curve for smoother lines
        ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
        ctx.stroke();

        // Start new sub-path to handle varying line widths
        ctx.beginPath();
        ctx.moveTo(xc, yc);
      }

      // Draw last segment
      if (smoothed.length > 2) {
        const last = smoothed.length - 1;
        const secondLast = smoothed.length - 2;

        ctx.lineWidth = brushSize * (smoothed[secondLast].pressure || 1);
        ctx.quadraticCurveTo(
          smoothed[secondLast].x,
          smoothed[secondLast].y,
          smoothed[last].x,
          smoothed[last].y,
        );
        ctx.stroke();
      }

      ctx.restore();
    }

    // Add to batch with complete smoothed points for high quality remote rendering
    actionBatchRef.current.push({
      type: "draw",
      x,
      y,
      pressure,
      color: tool === "eraser" ? "#121212" : color,
      brushSize,
      tool,
      timestamp: Date.now(),
      points: smoothed,
    });

    // Start batch timer if not already running
    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(
        flushActionBatch,
        BATCH_CONFIG.interval,
      );
    }

    // Flush if batch size exceeds limit
    if (actionBatchRef.current.length >= BATCH_CONFIG.size) {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
      flushActionBatch();
    }

    lastPointRef.current = { x, y };
  };

  const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    stopDrawing();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-full flex flex-col bg-[#171717]"
    >
      {error && (
        <div className="bg-red-500/20 text-red-400 p-2 text-center">
          {error}
        </div>
      )}
      <div className="flex justify-between items-center p-2 bg-[#1F1F1F] border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTool("pen")}
            className={`p-2 rounded-md ${tool === "pen" ? "bg-emerald-500/20 text-emerald-400" : "bg-[#2C2C2C] text-gray-300"} hover:bg-[#3C3C3C] transition`}
            title="Pen"
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={`p-2 rounded-md ${tool === "eraser" ? "bg-emerald-500/20 text-emerald-400" : "bg-[#2C2C2C] text-gray-300"} hover:bg-[#3C3C3C] transition`}
            title="Eraser"
          >
            <Eraser size={18} />
          </button>
          <div className="h-6 w-px bg-gray-700 mx-1"></div>
          <div className="flex items-center ml-2">
            <label htmlFor="color-picker" className="text-white mr-2 text-sm">
              Color:
            </label>
            <input
              type="color"
              id="color-picker"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-gray-600"
              disabled={tool === "eraser"}
            />
          </div>
          <div className="flex items-center">
            <label htmlFor="brush-size" className="text-white mr-2 text-sm">
              Size:
            </label>
            <input
              type="range"
              id="brush-size"
              min="1"
              max="30"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-24 accent-emerald-500"
            />
            <span className="text-white ml-2 w-6 text-sm">{brushSize}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={undoLastAction}
            className="p-2 rounded-md bg-[#2C2C2C] text-white hover:bg-[#3C3C3C] transition"
            title="Undo"
          >
            <Undo size={18} />
          </button>
          <button
            onClick={clearCanvas}
            className="p-2 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
            title="Clear"
          >
            <Trash size={18} />
          </button>
        </div>
      </div>

      <div
        ref={canvasContainerRef}
        className="flex-1 relative bg-gray-800 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawingTouch}
          onTouchMove={drawTouch}
          onTouchEnd={stopDrawingTouch}
          className="absolute top-0 left-0 w-full h-full cursor-crosshair bg-[#121212]"
        />
      </div>
    </motion.div>
  );
};

export default WhiteBoard;
