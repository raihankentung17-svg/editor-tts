import React, { useState, useRef, useEffect } from 'react';
import { 
  MousePointer2, Hand, ZoomIn, Shuffle, Layers, PenTool, Eraser, 
  Trash2, Download, ImagePlus, Loader2, Info, Ruler, Type, 
  TypeIcon, Square, LayoutGrid, PaintBucket, Copy, Puzzle,
  Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Move
} from 'lucide-react';

const PATTERNS = {
  'checker-blue': { background: 'conic-gradient(#0ea5e9 90deg, #ffffff 90deg 180deg, #0ea5e9 180deg 270deg, #ffffff 270deg)', backgroundSize: '24px 24px' },
  'checker-black': { background: 'conic-gradient(#171717 90deg, #ffffff 90deg 180deg, #171717 180deg 270deg, #ffffff 270deg)', backgroundSize: '30px 30px' },
  'stripes-black': { backgroundImage: 'repeating-linear-gradient(45deg, #171717 0, #171717 10px, #ffffff 10px, #ffffff 20px)' },
  'dots-red': { backgroundImage: 'radial-gradient(#ef4444 20%, transparent 20%), radial-gradient(#ef4444 20%, transparent 20%)', backgroundColor: '#ffffff', backgroundPosition: '0 0, 10px 10px', backgroundSize: '20px 20px' },
  'solid-white': { background: '#ffffff' },
  'solid-black': { background: '#0a0a0a' }
};

const generatePuzzlePath = (calcW, calcH, col, row, spanX, spanY, baseTabSize) => {
  const getTabDir = (x, y, edge) => {
    let seedX = x; let seedY = y;
    let isVert = edge === 'vert'; 
    const hash = Math.sin(seedX * 12.9898 + seedY * 78.233 + (isVert ? 100 : 0)) * 43758.5453;
    return (hash - Math.floor(hash)) > 0.5 ? 1 : -1;
  };

  const drawSegment = (x1, y1, x2, y2, tabDir, segLength) => {
    const dx = x2 - x1; const dy = y2 - y1;
    const ux = dx / segLength; const uy = dy / segLength;
    const vx = -uy; const vy = ux; 
    
    const tSize = Math.min(baseTabSize, segLength * 0.35); 
    
    const p = (l, n) => `${(x1 + ux * l + vx * n * tabDir).toFixed(2)},${(y1 + uy * l + vy * n * tabDir).toFixed(2)}`;

    return `L ${p(segLength * 0.38, 0)} ` +
           `C ${p(segLength * 0.38, tSize * 0.2)} ${p(segLength * 0.32, tSize * 0.5)} ${p(segLength * 0.38, tSize * 0.8)} ` + 
           `C ${p(segLength * 0.42, tSize * 1.15)} ${p(segLength * 0.58, tSize * 1.15)} ${p(segLength * 0.62, tSize * 0.8)} ` + 
           `C ${p(segLength * 0.68, tSize * 0.5)} ${p(segLength * 0.62, tSize * 0.2)} ${p(segLength * 0.62, 0)} ` +             
           `L ${x2.toFixed(2)},${y2.toFixed(2)} `;
  };

  let path = `M ${baseTabSize},${baseTabSize} `;
  const cellW = calcW / spanX;
  const cellH = calcH / spanY;

  for(let i=0; i<spanX; i++) {
     const dir = -getTabDir(col + i, row, 'horiz');
     const startX = baseTabSize + i * cellW;
     path += drawSegment(startX, baseTabSize, startX + cellW, baseTabSize, dir, cellW);
  }
  
  for(let i=0; i<spanY; i++) {
     const dir = getTabDir(col + spanX, row + i, 'vert');
     const startY = baseTabSize + i * cellH;
     path += drawSegment(baseTabSize + calcW, startY, baseTabSize + calcW, startY + cellH, dir, cellH);
  }

  for(let i=spanX-1; i>=0; i--) {
     const dir = getTabDir(col + i, row + spanY, 'horiz');
     const startX = baseTabSize + (i + 1) * cellW;
     path += drawSegment(startX, baseTabSize + calcH, startX - cellW, baseTabSize + calcH, dir, cellW);
  }

  for(let i=spanY-1; i>=0; i--) {
     const dir = -getTabDir(col, row + i, 'vert');
     const startY = baseTabSize + (i + 1) * cellH;
     path += drawSegment(baseTabSize, startY, baseTabSize, startY - cellH, dir, cellH);
  }

  return path + 'Z';
};

export default function App() {
  // --- DYNAMIC LAYER STATES ---
  const [layers, setLayers] = useState([
    { id: 'fg1', name: 'Grid Frame 1', visible: true, locked: false },
    { id: 'fg2', name: 'Grid Frame 2', visible: true, locked: false }
  ]);
  const [layerOffsets, setLayerOffsets] = useState({ fg1: { x: 0, y: 0 }, fg2: { x: 0, y: 0 } });

  const [images, setImages] = useState({ bg: null, fg1: null, fg2: null });
  const [layerModes, setLayerModes] = useState({ fg1: 'image', fg2: 'image' }); 
  const [layerShapes, setLayerShapes] = useState({ fg1: 'puzzle', fg2: 'rect' });
  const [layerPatterns, setLayerPatterns] = useState({ fg1: 'checker-blue', fg2: 'stripes-black' });
  const [layerColors, setLayerColors] = useState({ fg1: '#0ea5e9', fg2: '#ec4899' }); 

  const [canvasSize, setCanvasSize] = useState({ w: 550, h: 687 });
  const [canvasBgColor, setCanvasBgColor] = useState('#000000');

  const [gridCols, setGridCols] = useState(15);
  const [gridRows, setGridRows] = useState(18);
  const [gridGap, setGridGap] = useState(0); 
  const [brushSpan, setBrushSpan] = useState({ x: 1, y: 1 }); 
  const [brushTemplate, setBrushTemplate] = useState(null); 
  const [borderWidth, setBorderWidth] = useState(0); 
  const [enableShadow, setEnableShadow] = useState(false);
  
  const [activeCells, setActiveCells] = useState({});
  const [selectedCellKey, setSelectedCellKey] = useState(null);

  const [transforms, setTransforms] = useState({
    bg: { x: 0, y: 0, scale: 1, rotate: 0 },
    fg1: { x: 0, y: 0, scale: 1, rotate: 0 },
    fg2: { x: 0, y: 0, scale: 1, rotate: 0 },
    canvas: { x: 0, y: 0, scale: 1 }
  });
  
  const initialEffects = { specialEffect: 'none', blendMode: 'normal', brightness: 100, contrast: 100, saturation: 100, blur: 0 };
  const [layerEffects, setLayerEffects] = useState({
    bg: { ...initialEffects }, fg1: { ...initialEffects }, fg2: { ...initialEffects }
  });
  
  const [texts, setTexts] = useState([]);
  const [activeTextId, setActiveTextId] = useState(null);
  const [draggingTextId, setDraggingTextId] = useState(null);

  const [activeTool, setActiveTool] = useState('select'); 
  const [activeLayer, setActiveLayer] = useState('fg1');
  const [showRulers, setShowRulers] = useState(false);
  const [showGridHelper, setShowGridHelper] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const isResizingCell = useRef(false);
  const resizeState = useRef(null);
  const isMovingCell = useRef(false);
  const moveState = useRef(null);

  const [guides, setGuides] = useState([]);
  const [draggingGuide, setDraggingGuide] = useState(null);

  const viewportRef = useRef(null);
  const workspaceRef = useRef(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const cellWidth = (canvasSize.w - ((gridCols - 1) * gridGap)) / gridCols;
  const cellHeight = (canvasSize.h - ((gridRows - 1) * gridGap)) / gridRows;

  // --- LAYER LOGIC FUNCTIONS ---
  const addNewLayer = () => {
    const newId = `layer-${Date.now()}`;
    setLayers(prev => [{ id: newId, name: `Layer ${prev.length + 1}`, visible: true, locked: false }, ...prev]);
    setLayerModes(prev => ({ ...prev, [newId]: 'solid' }));
    setLayerShapes(prev => ({ ...prev, [newId]: 'puzzle' }));
    setLayerPatterns(prev => ({ ...prev, [newId]: 'solid-white' }));
    setLayerColors(prev => ({ ...prev, [newId]: '#0ea5e9' }));
    setTransforms(prev => ({ ...prev, [newId]: { x: 0, y: 0, scale: 1, rotate: 0 } }));
    setLayerEffects(prev => ({ ...prev, [newId]: { ...initialEffects } }));
    setLayerOffsets(prev => ({ ...prev, [newId]: { x: 0, y: 0 } }));
    setActiveLayer(newId);
  };

  const deleteLayer = (id) => {
    if (layers.length <= 1) return showError("Minimal 1 layer harus tersisa!");
    setLayers(prev => prev.filter(l => l.id !== id));
    if (activeLayer === id) setActiveLayer('canvas');
    setActiveCells(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        const cellLayerId = next[k].layer === 1 ? 'fg1' : next[k].layer === 2 ? 'fg2' : next[k].layer;
        if (cellLayerId === id) delete next[k];
      });
      return next;
    });
  };

  const toggleVisibility = (id) => setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  const toggleLock = (id) => setLayers(prev => prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l));
  const moveLayerOrder = (id, direction) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      if (direction === 'up' && idx > 0) { [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; }
      if (direction === 'down' && idx < prev.length - 1) { [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]; }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea') return;
      const key = e.key.toLowerCase();
      if (key === 'v') setActiveTool('select');
      else if (key === 'h') setActiveTool('grab');
      else if (key === 'm') setActiveTool('move');
      else if (key === 'z') setActiveTool('zoom');
      else if (key === 'p') setActiveTool('draw');
      else if (key === 'e') setActiveTool('erase');
      else if (key === 't') setActiveTool('text');
      else if (key === 'g') setShowGridHelper(prev => !prev);
      
      if (key === 'delete' || key === 'backspace') {
        if (selectedCellKey !== null) {
          setActiveCells(prev => {
            const next = { ...prev };
            delete next[selectedCellKey];
            return next;
          });
          setSelectedCellKey(null);
        }
        if (activeTextId !== null) {
          setTexts(prev => prev.filter(t => t.id !== activeTextId));
          setActiveTextId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCellKey, activeTextId]);

  const generateRandomGrid = () => {
    const newCells = {};
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        if (Math.random() > 0.6) {
          const id = `${col}-${row}-${Date.now()}-${Math.random()}`;
          const isFg2 = Math.random() > 0.8;
          newCells[id] = { layer: isFg2 ? 'fg2' : 'fg1', col, row, spanX: 1, spanY: 1 };
        }
      }
    }
    setActiveCells(newCells);
  };
  
  useEffect(() => { generateRandomGrid(); }, []);
  
  const clearGrid = () => { setActiveCells({}); setSelectedCellKey(null); setBrushTemplate(null); };

  const applySmartLayout = (type) => {
    const newCells = {};
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        let isValid = false;
        if (type === 'checker') isValid = (col + row) % 2 === 0;
        else if (type === 'border') isValid = (col === 0 || col === gridCols - 1 || row === 0 || row === gridRows - 1);
        else if (type === 'center') isValid = (col >= Math.floor(gridCols*0.2) && col <= Math.floor(gridCols*0.8) && row >= Math.floor(gridRows*0.2) && row <= Math.floor(gridRows*0.8));
        else if (type === 'diagonal') isValid = (col === row || col === gridCols - row - 1);
        
        if (isValid) {
          const id = `smart-${col}-${row}-${Date.now()}`;
          const targetLayer = activeLayer === 'canvas' || activeLayer === 'bg' ? 'fg1' : activeLayer;
          newCells[id] = { layer: targetLayer, col, row, spanX: 1, spanY: 1 };
        }
      }
    }
    setActiveCells(newCells);
  };

  const getWorkspaceCoords = (clientX, clientY) => {
    if (!workspaceRef.current) return { x: 0, y: 0 };
    const rect = workspaceRef.current.getBoundingClientRect();
    const scale = transforms.canvas.scale;
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  };

  const handlePointerDown = (e) => {
    if (viewportRef.current && e.pointerId) {
      try { viewportRef.current.setPointerCapture(e.pointerId); } catch(err){}
    }

    if (e.target.dataset.ruler) return;

    if (activeTool === 'select') {
      if (e.target.dataset.resizeHandle) {
        const [cellKey, direction] = e.target.dataset.resizeHandle.split('|');
        const cell = activeCells[cellKey];
        if (cell) {
          const { x: mouseX, y: mouseY } = getWorkspaceCoords(e.clientX, e.clientY);
          isResizingCell.current = true;
          
          const startX = cell.customX !== undefined ? cell.customX : (cell.col * (cellWidth + gridGap));
          const startY = cell.customY !== undefined ? cell.customY : (cell.row * (cellHeight + gridGap));
          const startW = cell.customW !== undefined ? cell.customW : (cell.spanX * cellWidth + (cell.spanX - 1) * gridGap);
          const startH = cell.customH !== undefined ? cell.customH : (cell.spanY * cellHeight + (cell.spanY - 1) * gridGap);

          resizeState.current = { key: cellKey, startX, startY, startW, startH, mouseX, mouseY, direction };
        }
        return;
      }
      
      if (e.target.dataset.textId) {
        setDraggingTextId(e.target.dataset.textId);
        setActiveTextId(e.target.dataset.textId);
        setSelectedCellKey(null);
        return;
      }

      if (e.target.dataset.guideId) {
        setDraggingGuide(e.target.dataset.guideId);
        return;
      }
      
      const cellEl = e.target.closest('[data-cell-key]');
      if (cellEl) {
        const key = cellEl.dataset.cellKey;
        setSelectedCellKey(key);
        setActiveTextId(null);
        
        const cell = activeCells[key];
        const { x: mouseX, y: mouseY } = getWorkspaceCoords(e.clientX, e.clientY);
        isMovingCell.current = true;
        
        const startX = cell.customX !== undefined ? cell.customX : (cell.col * (cellWidth + gridGap));
        const startY = cell.customY !== undefined ? cell.customY : (cell.row * (cellHeight + gridGap));

        moveState.current = { key, startX, startY, mouseX, mouseY };
      } else {
        setSelectedCellKey(null);
        setActiveTextId(null);
      }
      return;
    }

    if (activeTool === 'grab' || activeTool === 'move') {
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } 
    else if (activeTool === 'draw') {
      const { x, y } = getWorkspaceCoords(e.clientX, e.clientY);
      const col = Math.floor(x / (cellWidth + gridGap));
      const row = Math.floor(y / (cellHeight + gridGap));
      
      if (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
        const newKey = `draw-${Date.now()}-${Math.random()}`;
        const targetLayer = (activeLayer === 'canvas' || activeLayer === 'bg') ? 'fg1' : activeLayer;
        
        if (brushTemplate) {
           setActiveCells(prev => ({ ...prev, [newKey]: { layer: targetLayer, col, row, spanX: 1, spanY: 1, customW: brushTemplate.w, customH: brushTemplate.h } }));
        } else {
           setActiveCells(prev => ({ ...prev, [newKey]: { layer: targetLayer, col, row, spanX: brushSpan.x, spanY: brushSpan.y } }));
        }
      }
    }
    else if (activeTool === 'erase') {
      const cellEl = e.target.closest('[data-cell-key]');
      if (cellEl) {
        const key = cellEl.dataset.cellKey;
        setActiveCells(prev => { const next = { ...prev }; delete next[key]; return next; });
        if (selectedCellKey === key) setSelectedCellKey(null);
      }
    }
    else if (activeTool === 'text') {
      const coords = getWorkspaceCoords(e.clientX, e.clientY);
      const newText = { id: Date.now().toString(), text: 'PUZZLE COLLAGE', x: coords.x, y: coords.y, fontSize: 32, color: '#00ff00', fontWeight: 'bold' };
      setTexts(prev => [...prev, newText]);
      setActiveTextId(newText.id);
      setActiveTool('select'); 
    }
  };

  const handlePointerMove = (e) => {
    if (e.buttons === 0) {
      if (isDragging.current || isResizingCell.current || isMovingCell.current || draggingTextId || draggingGuide) handlePointerUp(e);
      return;
    }

    const { x: mouseX, y: mouseY } = getWorkspaceCoords(e.clientX, e.clientY);

    if (isResizingCell.current && resizeState.current !== null) {
      const state = resizeState.current;
      const deltaX = mouseX - state.mouseX;
      const deltaY = mouseY - state.mouseY;
      
      let newX = state.startX; let newY = state.startY;
      let newW = state.startW; let newH = state.startH;

      if (state.direction.includes('e')) newW = Math.max(15, state.startW + deltaX);
      if (state.direction.includes('s')) newH = Math.max(15, state.startH + deltaY);
      if (state.direction.includes('w')) {
        const clampedDelta = Math.min(deltaX, state.startW - 15);
        newX = state.startX + clampedDelta;
        newW = state.startW - clampedDelta;
      }
      if (state.direction.includes('n')) {
        const clampedDelta = Math.min(deltaY, state.startH - 15);
        newY = state.startY + clampedDelta;
        newH = state.startH - clampedDelta;
      }

      setActiveCells(prev => ({
        ...prev, [state.key]: { ...prev[state.key], customX: newX, customY: newY, customW: newW, customH: newH }
      }));
      return;
    }

    if (isMovingCell.current && moveState.current !== null) {
      const state = moveState.current;
      const deltaX = mouseX - state.mouseX;
      const deltaY = mouseY - state.mouseY;
      setActiveCells(prev => ({
        ...prev, [state.key]: { ...prev[state.key], customX: state.startX + deltaX, customY: state.startY + deltaY }
      }));
      return;
    }

    if (draggingTextId) {
      setTexts(prev => prev.map(t => t.id === draggingTextId ? { ...t, x: mouseX, y: mouseY } : t));
      return;
    }
    
    if (draggingGuide) {
      if (draggingGuide === 'new_h' || draggingGuide === 'new_v') {
        const newId = Date.now().toString();
        const type = draggingGuide === 'new_h' ? 'h' : 'v';
        setGuides(prev => [...prev, { id: newId, type, pos: type === 'h' ? mouseY : mouseX }]);
        setDraggingGuide(newId);
      } else {
        setGuides(prev => prev.map(g => g.id === draggingGuide ? { ...g, pos: g.type === 'h' ? mouseY : mouseX } : g));
      }
      return;
    }

    if (isDragging.current && (activeTool === 'grab' || activeTool === 'move')) {
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      const adjustment = 1 / transforms.canvas.scale;

      const activeLayerConf = layers.find(l => l.id === activeLayer);
      if (activeLayerConf?.locked) return; 

      if (activeTool === 'move' && activeLayer !== 'canvas' && activeLayer !== 'bg') {
        // MENGGESER CETAKAN PUZZLE (OFFSETS)
        setLayerOffsets(prev => ({
          ...prev, [activeLayer]: { 
            x: (prev[activeLayer]?.x || 0) + (deltaX * adjustment), 
            y: (prev[activeLayer]?.y || 0) + (deltaY * adjustment) 
          }
        }));
      } else {
        // MENGGESER GAMBAR DI DALAM PUZZLE (TRANSFORMS)
        const targetTransform = activeLayer === 'canvas' ? 'canvas' : activeLayer;
        setTransforms(prev => ({
          ...prev, 
          [targetTransform]: { 
            ...prev[targetTransform] || {x:0,y:0,scale:1}, 
            x: (prev[targetTransform]?.x || 0) + (deltaX * adjustment), 
            y: (prev[targetTransform]?.y || 0) + (deltaY * adjustment) 
          }
        }));
      }
      return;
    }

    if (activeTool === 'draw') {
      const col = Math.floor(mouseX / (cellWidth + gridGap));
      const row = Math.floor(mouseY / (cellHeight + gridGap));
      if (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
        const targetLayer = (activeLayer === 'canvas' || activeLayer === 'bg') ? 'fg1' : activeLayer;
        const isOverlap = Object.values(activeCells).some(c => c.col === col && c.row === row && c.layer === targetLayer && c.customX === undefined);
        if (!isOverlap) {
          const newKey = `draw-${Date.now()}-${Math.random()}`;
          if (brushTemplate) {
             setActiveCells(prev => ({ ...prev, [newKey]: { layer: targetLayer, col, row, spanX: 1, spanY: 1, customW: brushTemplate.w, customH: brushTemplate.h } }));
          } else {
             setActiveCells(prev => ({ ...prev, [newKey]: { layer: targetLayer, col, row, spanX: brushSpan.x, spanY: brushSpan.y } }));
          }
        }
      }
    }
    else if (activeTool === 'erase') {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cellEl = el?.closest('[data-cell-key]');
      if (cellEl) {
        const key = cellEl.dataset.cellKey;
        setActiveCells(prev => { const next = { ...prev }; delete next[key]; return next; });
        if (selectedCellKey === key) setSelectedCellKey(null);
      }
    }
  };

  const handlePointerUp = (e) => {
    if (viewportRef.current && e.pointerId) {
      try { viewportRef.current.releasePointerCapture(e.pointerId); } catch(err){}
    }
    isDragging.current = false;
    isResizingCell.current = false;
    resizeState.current = null;
    isMovingCell.current = false;
    moveState.current = null;
    setDraggingTextId(null);
    
    if (draggingGuide && draggingGuide !== 'new_h' && draggingGuide !== 'new_v') {
      const { x, y } = getWorkspaceCoords(e.clientX, e.clientY);
      if (x < -50 || x > canvasSize.w + 50 || y < -50 || y > canvasSize.h + 50) {
        setGuides(prev => prev.filter(g => g.id !== draggingGuide));
      }
    }
    setDraggingGuide(null);
  };

  const handleWheel = (e) => {
    if (activeTool !== 'zoom') return;
    const zoomFactor = -e.deltaY * 0.001;
    const targetTransform = activeLayer === 'canvas' ? 'canvas' : activeLayer;
    setTransforms(prev => ({
      ...prev, [targetTransform]: { ...prev[targetTransform] || {scale:1}, scale: Math.max(0.1, (prev[targetTransform]?.scale || 1) + zoomFactor) }
    }));
  };

  const handleImageUpload = async (e, layer) => {
    const file = e.target.files[0];
    if (!file) return;

    const processAndCompress = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const MAX_SIZE = 1500; 
            let width = img.width; let height = img.height;
            if (width > MAX_SIZE || height > MAX_SIZE) {
              const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
              width = Math.round(width * ratio); height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve({ url: canvas.toDataURL('image/jpeg', 0.85), finalWidth: width, finalHeight: height });
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    };

    try {
      const { url, finalWidth, finalHeight } = await processAndCompress(file);
      if (layer === 'bg') setCanvasSize({ w: finalWidth, h: finalHeight });
      setImages(prev => ({ ...prev, [layer]: url }));
    } catch (err) {
      showError("Gagal memproses gambar.");
    }
  };

  const exportImage = async (format) => {
    setIsExporting(true);
    const prevCanvasTransform = transforms.canvas;
    const prevRulerState = showRulers;
    const prevGridHelperState = showGridHelper;
    
    setTransforms(prev => ({ ...prev, canvas: { x: 0, y: 0, scale: 1 } }));
    setShowRulers(false); setShowGridHelper(false);
    setActiveTextId(null); setSelectedCellKey(null); 
    await new Promise(r => setTimeout(r, 200)); 

    try {
      if (!window.htmlToImage) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Gagal memuat modul export.'));
          document.head.appendChild(script);
        });
      }
      const node = workspaceRef.current;
      const exportOptions = { pixelRatio: 3, backgroundColor: canvasBgColor, style: { transform: 'none', margin: '0' }, skipFonts: false };
      const dataUrl = format === 'jpg' 
        ? await window.htmlToImage.toJpeg(node, { ...exportOptions, quality: 0.95 })
        : await window.htmlToImage.toPng(node, exportOptions);
      
      const link = document.createElement('a');
      link.download = `TTS_Art_${new Date().getTime()}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      showError("Gagal menyimpan gambar. Kurangi shadow jika error berlanjut.");
    } finally {
      setTransforms(prev => ({ ...prev, canvas: prevCanvasTransform }));
      setShowRulers(prevRulerState); setShowGridHelper(prevGridHelperState);
      setIsExporting(false);
    }
  };

  const showError = (msg) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(''), 3000); };
  
  const updateActiveLayerEffect = (key, value) => {
    if (activeLayer === 'canvas') return;
    setLayerEffects(prev => ({ ...prev, [activeLayer]: { ...prev[activeLayer], [key]: value } }));
  };

  const getFilterString = (layerId) => {
    const fx = layerEffects[layerId];
    if (!fx) return '';
    let effectFilterStr = '';
    if (fx.specialEffect === 'negative') effectFilterStr = 'invert(100%) ';
    else if (fx.specialEffect === 'xray') effectFilterStr = 'invert(100%) grayscale(100%) contrast(200%) ';
    else if (fx.specialEffect === 'dither') effectFilterStr = 'grayscale(100%) contrast(1000%) ';
    else if (fx.specialEffect === 'cyberpunk') effectFilterStr = 'saturate(250%) contrast(150%) hue-rotate(90deg) drop-shadow(0 0 5px #0ff) ';
    else if (fx.specialEffect === 'sepia') effectFilterStr = 'sepia(100%) contrast(120%) saturate(150%) ';
    else if (fx.specialEffect === 'matrix') effectFilterStr = 'grayscale(100%) sepia(100%) hue-rotate(90deg) contrast(200%) brightness(80%) ';
    else if (fx.specialEffect === 'acid-trip') effectFilterStr = 'saturate(400%) contrast(150%) hue-rotate(180deg) drop-shadow(0 0 10px #ff00ff) ';
    else if (fx.specialEffect === 'thermal') effectFilterStr = 'invert(100%) saturate(500%) hue-rotate(90deg) contrast(150%) ';
    else if (fx.specialEffect === 'noir') effectFilterStr = 'grayscale(100%) contrast(200%) brightness(90%) ';
    return `${effectFilterStr}brightness(${fx.brightness}%) contrast(${fx.contrast}%) saturate(${fx.saturation}%) blur(${fx.blur}px)`;
  };

  const updateActiveText = (key, value) => {
    if (!activeTextId) return;
    setTexts(prev => prev.map(t => t.id === activeTextId ? { ...t, [key]: value } : t));
  };
  
  const deleteActiveText = () => {
    if (!activeTextId) return;
    setTexts(prev => prev.filter(t => t.id !== activeTextId));
    setActiveTextId(null);
  };

  let workspaceCursor = 'default';
  if (activeTool === 'grab') workspaceCursor = isDragging.current ? 'grabbing' : 'grab';
  else if (activeTool === 'move') workspaceCursor = isDragging.current ? 'grabbing' : 'move';
  else if (activeTool === 'zoom') workspaceCursor = 'zoom-in'; 
  else if (activeTool === 'draw') workspaceCursor = (activeLayer === 'fg1' || activeLayer === 'fg2' || layers.find(l=>l.id === activeLayer)) ? 'crosshair' : 'not-allowed';
  else if (activeTool === 'erase') workspaceCursor = (activeLayer === 'fg1' || activeLayer === 'fg2' || layers.find(l=>l.id === activeLayer)) ? 'cell' : 'not-allowed';
  else if (activeTool === 'text') workspaceCursor = 'text';

  const activeTextNode = texts.find(t => t.id === activeTextId);
  const activeSelectedCell = activeCells[selectedCellKey];

  return (
    <div className="flex h-screen w-full bg-neutral-950 text-neutral-300 font-sans overflow-hidden">
      
      {/* --- LEFT TOOLBAR --- */}
      <div className="w-16 bg-neutral-900 border-r border-neutral-800 flex flex-col items-center py-4 gap-3 z-30 shadow-[5px_0_15px_rgba(0,0,0,0.5)] flex-shrink-0">
        <div className="text-[10px] font-bold text-teal-500 mb-2 tracking-widest text-center">TTS V8<br/><span className="text-[8px] text-neutral-500">PRO</span></div>
        
        <ToolButton icon={<MousePointer2 size={18} />} active={activeTool === 'select'} onClick={() => setActiveTool('select')} tooltip="Pilih / Transform (V)" />
        <ToolButton icon={<Hand size={18} />} active={activeTool === 'grab'} onClick={() => setActiveTool('grab')} tooltip="Geser Kanvas/Foto (H)" />
        <ToolButton icon={<Move size={18} />} active={activeTool === 'move'} onClick={() => setActiveTool('move')} tooltip="Geser Cetakan Puzzle (M)" />
        <ToolButton icon={<ZoomIn size={18} />} active={activeTool === 'zoom'} onClick={() => setActiveTool('zoom')} tooltip="Zoom (Z / Scroll)" />
        <ToolButton icon={<Type size={18} />} active={activeTool === 'text'} onClick={() => setActiveTool('text')} tooltip="Tambah Teks (T)" />
        
        <div className="w-8 h-px bg-neutral-700 my-1"></div>

        <ToolButton icon={<PenTool size={18} />} active={activeTool === 'draw'} onClick={() => setActiveTool('draw')} tooltip="Gambar Grid (P)" />
        <ToolButton icon={<Eraser size={18} />} active={activeTool === 'erase'} onClick={() => setActiveTool('erase')} tooltip="Hapus Grid (E)" />
        
        <div className="w-8 h-px bg-neutral-700 my-1"></div>
        
        <ToolButton icon={<Ruler size={18} />} active={showRulers} onClick={() => setShowRulers(!showRulers)} tooltip="Tampilkan Penggaris" />
        <ToolButton icon={<LayoutGrid size={18} />} active={showGridHelper} onClick={() => setShowGridHelper(!showGridHelper)} tooltip="Garis Bantu Grid (G)" />
      </div>

      {/* --- MAIN VIEWPORT --- */}
      <div 
        ref={viewportRef}
        className="flex-1 relative flex items-center justify-center bg-neutral-950 overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="absolute top-4 left-6 bg-neutral-900/90 px-3 py-2 rounded-lg border border-neutral-700 flex items-center gap-2 text-sm z-40 shadow-xl backdrop-blur-md">
          <Layers className="text-teal-400" size={16} />
          <span className="text-neutral-300 text-xs">Target Operasi:</span>
          <select 
            className="bg-neutral-800 text-white font-bold outline-none cursor-pointer rounded px-2 py-1 text-xs border border-neutral-600 focus:border-teal-500"
            value={activeLayer}
            onChange={(e) => setActiveLayer(e.target.value)}
          >
            <option value="canvas">🔍 Tampilan Kanvas (Global)</option>
            <option value="bg">🖼️ Latar Belakang</option>
            {layers.map(l => (
               <option key={l.id} value={l.id}>🔲 {l.name}</option>
            ))}
          </select>
        </div>

        {errorMessage && (
          <div className="absolute top-4 right-4 bg-red-900/90 border border-red-500 px-4 py-2 rounded text-red-200 text-sm z-50 flex items-center gap-2 shadow-lg animate-pulse">
            <Info size={16} /> {errorMessage}
          </div>
        )}

        {showRulers && !isExporting && (
          <>
            <div className="absolute top-0 left-0 w-full h-5 bg-neutral-800/90 border-b border-neutral-600 z-30 cursor-row-resize" style={{ backgroundImage: 'repeating-linear-gradient(to right, transparent, transparent 9px, #555 9px, #555 10px)' }} data-ruler="top" onPointerDown={() => setDraggingGuide('new_h')}></div>
            <div className="absolute top-0 left-0 h-full w-5 bg-neutral-800/90 border-r border-neutral-600 z-30 cursor-col-resize" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 9px, #555 9px, #555 10px)' }} data-ruler="left" onPointerDown={() => setDraggingGuide('new_v')}></div>
          </>
        )}

        {/* WORKSPACE SCALER */}
        <div 
          style={{ 
            transform: `translate(${transforms.canvas.x}px, ${transforms.canvas.y}px) scale(${transforms.canvas.scale})`,
            transition: isDragging.current || draggingTextId || isResizingCell.current || isMovingCell.current ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          <div 
            ref={workspaceRef}
            className="relative shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
            style={{ 
              width: canvasSize.w, height: canvasSize.h, 
              backgroundColor: canvasBgColor, 
              cursor: workspaceCursor,
            }}
          >
            {!images.bg && !images.fg1 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-600 pointer-events-none">
                <ImagePlus className="mb-3 opacity-30" size={48} />
                <p className="text-sm">Unggah gambar di panel kanan</p>
              </div>
            )}

            {images.bg && (
              <div className="absolute inset-0 z-0 select-none pointer-events-none" style={{ mixBlendMode: layerEffects['bg']?.blendMode || 'normal' }}>
                <img 
                  src={images.bg} alt="Background" draggable="false"
                  className="w-full h-full object-cover origin-center"
                  style={{ transform: `translate(${transforms.bg.x}px, ${transforms.bg.y}px) scale(${transforms.bg.scale}) rotate(${transforms.bg.rotate || 0}deg)`, filter: getFilterString('bg') }}
                />
              </div>
            )}

            {showGridHelper && !isExporting && (
              <div 
                className="absolute inset-0 z-40 pointer-events-none"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gridTemplateRows: `repeat(${gridRows}, 1fr)`, gap: `${gridGap}px` }}
              >
                {Array.from({ length: gridCols * gridRows }).map((_, i) => (
                  <div key={`wireframe-${i}`} className="border-[0.5px] border-white/30 border-dashed mix-blend-difference" />
                ))}
              </div>
            )}

            {/* --- TRUE HYBRID JIGSAW PUZZLE CELLS (Z-INDEX LAYERED) --- */}
            <div className="absolute inset-0 pointer-events-none">
              {layers.slice().reverse().map(layer => {
                if (!layer.visible) return null;
                
                const layerCells = Object.entries(activeCells).filter(([k, v]) => {
                   const cellLayerId = v.layer === 1 ? 'fg1' : v.layer === 2 ? 'fg2' : v.layer;
                   return cellLayerId === layer.id;
                });

                return layerCells.map(([key, cellData]) => {
                  const lName = layer.id;
                  const isActive = true;
                  const isPatternMode = layerModes[lName] === 'pattern';
                  const isSolidMode = layerModes[lName] === 'solid'; 
                  const activeImage = images[lName];
                  const activeTransform = transforms[lName] || { x: 0, y: 0, scale: 1, rotate: 0 };
                  const activeFilter = getFilterString(lName);
                  const activeBlendMode = layerEffects[lName]?.blendMode || 'normal'; 
                  const isSelected = selectedCellKey === key && activeTool === 'select' && !isExporting;
                  const cellShape = layerShapes[lName] || 'rect';
                  const isPuzzle = cellShape === 'puzzle';

                  // GLOBAL LAYER OFFSET (PATTERN MOVEMENT)
                  const offsetX = layerOffsets[lName]?.x || 0;
                  const offsetY = layerOffsets[lName]?.y || 0;

                  const posX = (cellData.customX !== undefined ? cellData.customX : cellData.col * (cellWidth + gridGap)) + offsetX;
                  const posY = (cellData.customY !== undefined ? cellData.customY : cellData.row * (cellHeight + gridGap)) + offsetY;
                  const calcW = Math.max(1, cellData.customW !== undefined ? cellData.customW : (cellData.spanX * cellWidth + (cellData.spanX - 1) * gridGap));
                  const calcH = Math.max(1, cellData.customH !== undefined ? cellData.customH : (cellData.spanY * cellHeight + (cellData.spanY - 1) * gridGap));
                  
                  const baseTabSize = isPuzzle ? Math.min(cellWidth, cellHeight) * 0.25 : 0; 
                  
                  const renderX = posX - baseTabSize;
                  const renderY = posY - baseTabSize;
                  const renderW = calcW + baseTabSize * 2;
                  const renderH = calcH + baseTabSize * 2;

                  const puzzlePath = isPuzzle ? generatePuzzlePath(calcW, calcH, cellData.col, cellData.row, cellData.spanX, cellData.spanY, baseTabSize) : '';
                  const puzzleSvgUrl = isPuzzle ? `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${renderW} ${renderH}'><path d='${puzzlePath}' fill='black'/></svg>`)}")` : 'none';

                  // Menghilangkan offset dari masking gambar agar gambar bergerak BERSAMA dengan cetakan
                  const originalRenderX = renderX - offsetX;
                  const originalRenderY = renderY - offsetY;

                  return (
                    <div 
                      key={key} 
                      data-cell-key={key}
                      className={`absolute box-border ${layer.locked ? 'pointer-events-none' : 'pointer-events-auto'}
                        ${isSelected ? 'z-[100] overflow-visible cursor-move' : 'z-20 overflow-hidden cursor-pointer'}
                      `}
                      style={{ 
                        left: renderX, top: renderY, width: renderW, height: renderH,
                        border: !isPuzzle && borderWidth > 0 ? `${borderWidth}px solid rgba(255, 255, 255, 0.85)` : 'none',
                        mixBlendMode: activeBlendMode,
                        WebkitMaskImage: puzzleSvgUrl, maskImage: puzzleSvgUrl,
                        WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
                        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                        filter: enableShadow ? (isPuzzle ? 'drop-shadow(0px 4px 10px rgba(0,0,0,0.8))' : undefined) : undefined,
                        boxShadow: enableShadow && !isPuzzle ? '0 4px 15px rgba(0,0,0,0.9)' : 'none'
                      }}
                    >
                      {isPuzzle && borderWidth > 0 && (
                        <svg className="absolute inset-0 pointer-events-none z-50" width="100%" height="100%" viewBox={`0 0 ${renderW} ${renderH}`}>
                          <path d={puzzlePath} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={borderWidth * 2} />
                        </svg>
                      )}

                      <div 
                        className="absolute pointer-events-none transition-opacity duration-200"
                        style={{
                          width: canvasSize.w, height: canvasSize.h,
                          left: -originalRenderX - (!isPuzzle ? borderWidth : 0), 
                          top: -originalRenderY - (!isPuzzle ? borderWidth : 0),
                          filter: activeFilter,
                          opacity: isSelected ? 0.75 : 1 
                        }}
                      >
                        {!isPatternMode && !isSolidMode && activeImage && (
                          <img 
                            src={activeImage} alt="Grid Content" draggable="false" className="w-full h-full object-contain origin-center select-none"
                            style={{ transform: `translate(${activeTransform.x}px, ${activeTransform.y}px) scale(${activeTransform.scale}) rotate(${activeTransform.rotate || 0}deg)` }}
                          />
                        )}
                        {isPatternMode && (
                          <div className="w-full h-full" style={{ ...PATTERNS[layerPatterns[lName]], transform: `translate(${activeTransform.x}px, ${activeTransform.y}px) scale(${activeTransform.scale}) rotate(${activeTransform.rotate || 0}deg)` }} />
                        )}
                        {isSolidMode && (
                          <div className="w-full h-full" style={{ backgroundColor: layerColors[lName] }} />
                        )}
                      </div>

                      {isSelected && (
                        <div className="absolute border-[2px] border-cyan-400 z-50 pointer-events-none shadow-[0_0_15px_rgba(0,255,255,0.7)]" style={{ left: baseTabSize, top: baseTabSize, width: calcW, height: calcH }}>
                          <div data-resize-handle={`${key}|nw`} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-[1.5px] border-cyan-500 cursor-nwse-resize pointer-events-auto hover:bg-cyan-200 transition-all shadow-sm" />
                          <div data-resize-handle={`${key}|ne`} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-[1.5px] border-cyan-500 cursor-nesw-resize pointer-events-auto hover:bg-cyan-200 transition-all shadow-sm" />
                          <div data-resize-handle={`${key}|sw`} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-[1.5px] border-cyan-500 cursor-nesw-resize pointer-events-auto hover:bg-cyan-200 transition-all shadow-sm" />
                          <div data-resize-handle={`${key}|se`} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-[1.5px] border-cyan-500 cursor-nwse-resize pointer-events-auto hover:bg-cyan-200 transition-all shadow-sm" />
                        </div>
                      )}
                    </div>
                  );
                });
              })}
            </div>

            {texts.map(t => (
              <div
                key={t.id} data-text-id={t.id}
                className={`absolute select-none whitespace-pre-wrap leading-tight z-40
                  ${activeTextId === t.id && !isExporting ? 'outline outline-2 outline-cyan-400 outline-offset-4 cursor-move' : ''}
                  ${activeTool === 'select' ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-cyan-400/50' : 'pointer-events-none'}
                `}
                style={{
                  left: t.x, top: t.y, fontSize: `${t.fontSize}px`, color: t.color, fontWeight: t.fontWeight,
                  transform: 'translate(-50%, -50%)', fontFamily: 'sans-serif'
                }}
              >
                {t.text}
              </div>
            ))}

            {showRulers && !isExporting && guides.map(g => (
              <div 
                key={g.id} data-guide-id={g.id}
                className={`absolute bg-cyan-400 shadow-[0_0_4px_rgba(0,255,255,0.8)] z-50 transition-colors
                  ${activeTool === 'select' ? 'pointer-events-auto hover:bg-white' : 'pointer-events-none'}
                  ${draggingGuide === g.id ? 'bg-white z-50' : ''}
                `}
                style={{ ...(g.type === 'h' ? { top: g.pos, left: -50, right: -50, height: 2, cursor: 'row-resize' } : { left: g.pos, top: -50, bottom: -50, width: 2, cursor: 'col-resize' }) }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* --- RIGHT SIDEBAR --- */}
      <div className="w-[340px] bg-neutral-900 border-l border-neutral-800 p-5 flex flex-col gap-6 overflow-y-auto z-20 flex-shrink-0 custom-scrollbar shadow-[-5px_0_15px_rgba(0,0,0,0.5)]">
        
        {/* EXPORT */}
        <div className="bg-gradient-to-r from-teal-900/40 to-blue-900/40 p-4 rounded-xl border border-teal-900/50 shadow-inner">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2 text-xs">
            <Download className="text-teal-400" size={14} /> SIMPAN POSTER (HI-RES)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={isExporting} onClick={() => exportImage('jpg')} className="py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50">
              {isExporting ? <Loader2 className="animate-spin mx-auto" size={14} /> : 'JPG'}
            </button>
            <button disabled={isExporting} onClick={() => exportImage('png')} className="py-2 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50 shadow-[0_0_10px_rgba(13,148,136,0.3)]">
              {isExporting ? <Loader2 className="animate-spin mx-auto" size={14} /> : 'PNG'}
            </button>
          </div>
        </div>

        {/* --- DYNAMIC LAYER PANEL (PHOTOSHOP STYLE) --- */}
        <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 shadow-inner">
          <div className="flex justify-between items-center mb-3">
             <h3 className="text-teal-400 font-bold text-[11px] tracking-wider uppercase">LAYER PANEL</h3>
             <button onClick={addNewLayer} className="text-[10px] bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded text-white font-bold transition border border-neutral-700">+ NEW</button>
          </div>
          
          <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
            {layers.map((layer, index) => (
               <div key={layer.id} className={`flex items-center justify-between p-2 rounded border transition-colors ${activeLayer === layer.id ? 'bg-neutral-800 border-teal-500' : 'bg-neutral-950 border-neutral-800 hover:border-neutral-600'}`}>
                 <div className="flex items-center gap-2">
                    <button onClick={() => toggleVisibility(layer.id)} className={`${layer.visible ? 'text-teal-400' : 'text-neutral-600'} hover:text-white transition`}>
                      {layer.visible ? <Eye size={14}/> : <EyeOff size={14}/>}
                    </button>
                    <button onClick={() => toggleLock(layer.id)} className={`${layer.locked ? 'text-red-400' : 'text-neutral-600'} hover:text-white transition`}>
                      {layer.locked ? <Lock size={14}/> : <Unlock size={14}/>}
                    </button>
                    <span onClick={() => setActiveLayer(layer.id)} className={`text-[11px] cursor-pointer select-none truncate w-24 ${activeLayer === layer.id ? 'text-white font-bold' : 'text-neutral-500'}`}>{layer.name}</span>
                 </div>
                 <div className="flex items-center gap-1">
                    <button onClick={() => moveLayerOrder(layer.id, 'up')} disabled={index === 0} className="text-neutral-500 hover:text-white disabled:opacity-20"><ChevronUp size={14}/></button>
                    <button onClick={() => moveLayerOrder(layer.id, 'down')} disabled={index === layers.length - 1} className="text-neutral-500 hover:text-white disabled:opacity-20"><ChevronDown size={14}/></button>
                    <button onClick={() => deleteLayer(layer.id)} className="text-red-900 hover:text-red-500 ml-1"><Trash2 size={12}/></button>
                 </div>
               </div>
            ))}
          </div>
        </div>

        {/* KANVAS & LATAR BELAKANG */}
        <div>
          <h3 className="text-neutral-400 font-bold mb-3 text-[11px] tracking-wider flex items-center gap-1"><Square size={14} /> UKURAN KANVAS & LATAR</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-neutral-500">Lebar (W)</label>
              <input type="number" value={canvasSize.w} onChange={(e) => setCanvasSize(p => ({...p, w: Number(e.target.value)}))} className="bg-neutral-950 text-white text-xs rounded p-2 outline-none border border-neutral-800" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-neutral-500">Tinggi (H)</label>
              <input type="number" value={canvasSize.h} onChange={(e) => setCanvasSize(p => ({...p, h: Number(e.target.value)}))} className="bg-neutral-950 text-white text-xs rounded p-2 outline-none border border-neutral-800" />
            </div>
          </div>
          <div className="flex items-center justify-between bg-neutral-950 p-2 rounded border border-neutral-800">
            <span className="text-[10px] text-neutral-400">Warna Dasar Latar</span>
            <input type="color" value={canvasBgColor} onChange={(e) => setCanvasBgColor(e.target.value)} className="w-8 h-8 bg-transparent rounded cursor-pointer border-none p-0" />
          </div>
        </div>

        <div className="h-px bg-neutral-800"></div>

        {/* PENGATURAN ISI LAYER DINAMIS (GAMBAR/POLA/WARNA) */}
        {activeLayer !== 'canvas' && (
          <div>
            <h3 className="text-teal-400 font-bold mb-3 text-[11px] tracking-wider uppercase">KONTEN LAYER {activeLayer === 'bg' ? 'LATAR BELAKANG' : activeLayer.toUpperCase()}</h3>
            
            {activeLayer === 'bg' ? (
              <div className="bg-neutral-950 p-2 rounded border border-neutral-800 border-l-2 border-l-white">
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'bg')} className="w-full text-[10px] text-neutral-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-neutral-800 file:text-white cursor-pointer" />
              </div>
            ) : (
              <div className="bg-neutral-950 p-2 rounded border border-neutral-800 border-l-2 border-l-teal-500">
                 {/* Shape selector */}
                 <div className="flex justify-between items-center mb-3">
                  <label className="text-[9px] text-neutral-400 flex items-center gap-1"><Puzzle size={10} /> Bentuk Potongan</label>
                  <select value={layerShapes[activeLayer] || 'rect'} onChange={(e) => setLayerShapes(p => ({...p, [activeLayer]: e.target.value}))} className="bg-neutral-800 text-[9px] text-white rounded px-1 outline-none border border-neutral-700">
                    <option value="rect">Kotak (Persegi)</option>
                    <option value="puzzle">Jigsaw Puzzle</option>
                  </select>
                </div>
                {/* Mode selector */}
                 <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-teal-500">Isi Layer</label>
                  <select value={layerModes[activeLayer] || 'image'} onChange={(e) => setLayerModes(p => ({...p, [activeLayer]: e.target.value}))} className="bg-neutral-800 text-[9px] text-white rounded px-1 outline-none border border-neutral-700">
                    <option value="image">Gunakan Foto</option>
                    <option value="pattern">Gunakan Pola</option>
                    <option value="solid">Warna Solid</option>
                  </select>
                </div>
                {/* Inputs based on Mode */}
                {layerModes[activeLayer] === 'image' || !layerModes[activeLayer] ? (
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, activeLayer)} className="w-full text-[10px] text-neutral-400 cursor-pointer file:bg-neutral-800 file:text-teal-400 file:border-0 file:rounded file:px-2 file:mr-2" />
                ) : layerModes[activeLayer] === 'pattern' ? (
                  <select value={layerPatterns[activeLayer] || 'checker-blue'} onChange={(e) => setLayerPatterns(p => ({...p, [activeLayer]: e.target.value}))} className="w-full bg-neutral-800 text-xs text-white p-1 rounded outline-none">
                    <option value="checker-blue">Catur Biru Muda</option><option value="checker-black">Catur Hitam Putih</option><option value="stripes-black">Garis Diagonal</option><option value="dots-red">Titik Merah (Halftone)</option><option value="solid-white">Blok Putih Solid</option>
                  </select>
                ) : (
                  <div className="flex items-center justify-between bg-neutral-800 p-1.5 rounded">
                     <span className="text-[10px] text-white flex items-center gap-1"><PaintBucket size={12} /> Pilih Warna Solid:</span>
                     <input type="color" value={layerColors[activeLayer] || '#0ea5e9'} onChange={(e) => setLayerColors(p => ({...p, [activeLayer]: e.target.value}))} className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="h-px bg-neutral-800"></div>

        {/* TYPOGRAPHY */}
        <div>
          <h3 className="text-neutral-400 font-bold mb-3 text-[11px] tracking-wider flex items-center gap-1"><TypeIcon size={14} /> TIPOGRAFI & TEKS</h3>
          {activeTextNode ? (
            <div className="bg-cyan-950/30 p-3 rounded-lg border border-cyan-900/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-cyan-400 font-bold">EDIT TEKS TERPILIH</span>
                <button onClick={deleteActiveText} className="text-red-400 hover:text-red-300 text-[10px]"><Trash2 size={12} /></button>
              </div>
              <textarea value={activeTextNode.text} onChange={(e) => updateActiveText('text', e.target.value)} className="w-full bg-neutral-900 text-white text-xs p-2 rounded border border-neutral-700 outline-none focus:border-cyan-500 min-h-[60px]" placeholder="Ketik teks disini..." />
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-neutral-500">Ukuran (px)</label>
                  <input type="number" value={activeTextNode.fontSize} onChange={(e) => updateActiveText('fontSize', Number(e.target.value))} className="bg-neutral-900 text-white text-xs p-1.5 rounded border border-neutral-700" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-neutral-500">Warna</label>
                  <input type="color" value={activeTextNode.color} onChange={(e) => updateActiveText('color', e.target.value)} className="w-full h-7 bg-neutral-900 rounded border border-neutral-700 cursor-pointer" />
                </div>
              </div>
              <button onClick={() => updateActiveText('fontWeight', activeTextNode.fontWeight === 'bold' ? 'normal' : 'bold')} className={`w-full py-1 text-xs rounded border ${activeTextNode.fontWeight === 'bold' ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}>Bold</button>
            </div>
          ) : (
            <div className="bg-neutral-950 p-3 rounded text-center border border-neutral-800">
              <p className="text-[10px] text-neutral-500 mb-2">Pilih alat 'T' atau klik teks di kanvas.</p>
              <button onClick={() => { setActiveTool('text'); showError("Klik di kanvas untuk menaruh teks."); }} className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs transition-colors border border-neutral-700">+ Tambah Teks Baru</button>
            </div>
          )}
        </div>

        <div className="h-px bg-neutral-800"></div>

        {/* DRAW SETTINGS */}
        <div>
          <h3 className="text-neutral-400 font-bold mb-3 text-[11px] tracking-wider flex justify-between items-center">
            PENGATURAN GRID & KUAS
          </h3>

          {/* MENU KLONING SIMPLE & BERSIH (Pindah ke Sini) */}
          {activeSelectedCell && (
            <div className="bg-teal-950/30 p-3 mb-4 rounded-lg border border-teal-500/50 shadow-[0_0_10px_rgba(45,212,191,0.1)]">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></span>
                  <span className="text-teal-400 font-bold text-[11px] tracking-wider">KOTAK TERPILIH</span>
                </div>
                <button onClick={() => {
                  setActiveCells(p => { const n = {...p}; delete n[selectedCellKey]; return n; });
                  setSelectedCellKey(null);
                }} className="text-red-400 hover:text-red-300 text-[10px]"><Trash2 size={14} /></button>
              </div>
              
              <div className="mt-3">
                <button 
                  onClick={() => {
                    const w = activeSelectedCell.customW !== undefined ? activeSelectedCell.customW : (activeSelectedCell.spanX * cellWidth + (activeSelectedCell.spanX - 1) * gridGap);
                    const h = activeSelectedCell.customH !== undefined ? activeSelectedCell.customH : (activeSelectedCell.spanY * cellHeight + (activeSelectedCell.spanY - 1) * gridGap);
                    setBrushTemplate({w, h});
                    setActiveTool('draw'); 
                  }} 
                  className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-bold flex justify-center items-center gap-2 transition-colors shadow-sm"
                >
                  <Copy size={14} /> Salin Jadikan Template Kuas
                </button>
              </div>
            </div>
          )}

          <div className="mb-4 bg-cyan-950/20 p-3 rounded-lg border border-cyan-900/30">
            <h4 className="text-[10px] text-cyan-400 font-bold mb-2 flex items-center gap-1"><PenTool size={12} /> ALAT KUAS (DRAW)</h4>
            
            {brushTemplate ? (
              <div className="bg-cyan-900/40 p-2.5 rounded border border-cyan-500/50 flex justify-between items-center">
                <div>
                  <span className="text-[9px] text-cyan-300 block mb-0.5">Template Kustom Aktif:</span>
                  <span className="text-xs text-white font-bold tracking-wider">{Math.round(brushTemplate.w)}px <span className="text-cyan-500 font-normal">x</span> {Math.round(brushTemplate.h)}px</span>
                </div>
                <button onClick={() => setBrushTemplate(null)} className="p-1.5 bg-red-950 text-red-400 rounded border border-red-900/50 hover:bg-red-900 hover:text-white transition-colors" title="Hapus Template">
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <>
                <p className="text-[9px] text-neutral-400 mb-3 leading-relaxed">Pilih kotak mana saja lalu klik <b>"Salin Template"</b> untuk merekam bentuknya.</p>
                <FilterSlider label="Lebar Kotak Standar (X)" max={15} min={1} onChange={(v) => setBrushSpan(p => ({...p, x: v}))} value={brushSpan.x} />
                <div className="h-2"></div>
                <FilterSlider label="Tinggi Kotak Standar (Y)" max={15} min={1} onChange={(v) => setBrushSpan(p => ({...p, y: v}))} value={brushSpan.y} />
              </>
            )}
          </div>

          <div className="space-y-4 mb-4">
            <FilterSlider label="Celah Antar Kotak (Gap)" max={40} min={0} onChange={setGridGap} value={gridGap} />
            <FilterSlider label="Ketebalan Garis Batas" max={5} min={0} onChange={setBorderWidth} value={borderWidth} />
            <div className="flex items-center justify-between bg-neutral-800/40 p-2 rounded border border-neutral-800/50">
              <span className="text-[11px] text-neutral-400">Bayangan Kotak (Shadow)</span>
              <button onClick={() => setEnableShadow(!enableShadow)} className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${enableShadow ? 'bg-teal-500' : 'bg-neutral-700'}`}>
                <div className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-300 ${enableShadow ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-neutral-500">Kolom (Max 250)</label>
              <input type="number" min="2" max="250" value={gridCols} onChange={(e) => setGridCols(Number(e.target.value))} className="bg-neutral-950 text-white text-xs rounded p-2 outline-none border border-neutral-800" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-neutral-500">Baris (Max 250)</label>
              <input type="number" min="2" max="250" value={gridRows} onChange={(e) => setGridRows(Number(e.target.value))} className="bg-neutral-950 text-white text-xs rounded p-2 outline-none border border-neutral-800" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-neutral-950 border border-neutral-800 rounded p-1">
              <span className="text-[10px] text-neutral-500 pl-2">Pola Instan:</span>
              <select onChange={(e) => { if(e.target.value) applySmartLayout(e.target.value); e.target.value=''; }} className="bg-neutral-800 text-teal-400 text-[10px] rounded px-2 py-1 outline-none border border-neutral-700 cursor-pointer">
                <option value="">-- Pilih Pola --</option>
                <option value="checker">Papan Catur</option>
                <option value="border">Bingkai Luar</option>
                <option value="center">Blok Tengah</option>
                <option value="diagonal">Silang (X)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={generateRandomGrid} className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs transition-colors flex justify-center gap-1"><Shuffle size={14} /> Acak Chaos</button>
              <button onClick={clearGrid} className="flex-1 py-2 bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-900/30 rounded text-xs transition-colors flex justify-center gap-1"><Trash2 size={14} /> Kosongkan</button>
            </div>
          </div>
        </div>

        <div className="h-px bg-neutral-800"></div>

        {/* EFEK & FILTER (Dinamic by Layer) */}
        {activeLayer !== 'canvas' ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-teal-400 font-bold text-[11px] tracking-wider uppercase">EFEK VISUAL {activeLayer === 'bg' ? 'LATAR BELAKANG' : activeLayer}</h3>
            </div>

            <div className="flex flex-col gap-1 mb-4">
              <label className="text-[11px] text-neutral-500">Blend Mode (Pencampuran)</label>
              <select 
                value={layerEffects[activeLayer]?.blendMode || 'normal'} 
                onChange={(e) => updateActiveLayerEffect('blendMode', e.target.value)} 
                className="bg-neutral-950 border border-neutral-800 text-white text-xs rounded p-2 outline-none focus:border-teal-500"
              >
                <option value="normal">Normal</option>
                <option value="multiply">Multiply (Gelap)</option>
                <option value="screen">Screen (Terang)</option>
                <option value="overlay">Overlay (Kontras)</option>
                <option value="color-dodge">Color Dodge (Neon Glow)</option>
                <option value="difference">Difference (Invert)</option>
              </select>
            </div>

            <div className="mb-4 bg-neutral-800/30 p-3 rounded-lg border border-neutral-800">
              <FilterSlider label="Rotasi Gambar (°)" max={180} min={-180} onChange={(val) => setTransforms(prev => ({...prev, [activeLayer]: {...prev[activeLayer], rotate: val}}))} value={transforms[activeLayer]?.rotate || 0} />
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-neutral-500">Tema Spesial</label>
                <select value={layerEffects[activeLayer]?.specialEffect || 'none'} onChange={(e) => updateActiveLayerEffect('specialEffect', e.target.value)} className="bg-neutral-950 border border-neutral-800 text-white text-xs rounded p-2 outline-none focus:border-teal-500">
                  <option value="none">Normal</option>
                  <option value="cyberpunk">Cyberpunk (Neon)</option>
                  <option value="matrix">The Matrix (Hijau)</option>
                  <option value="sepia">Vintage (Sepia)</option>
                  <option value="negative">Invert Negatif</option>
                  <option value="xray">X-Ray Scanner</option>
                  <option value="dither">Dither Kasar</option>
                  <option value="acid-trip">Acid Trip (Psychedelic)</option>
                  <option value="thermal">Thermal (Sensor Panas)</option>
                  <option value="noir">Noir (B&W Kontras)</option>
                </select>
              </div>
              <FilterSlider label="Kecerahan" max={200} min={0} onChange={(val) => updateActiveLayerEffect('brightness', val)} value={layerEffects[activeLayer]?.brightness || 100} />
              <FilterSlider label="Kontras" max={200} min={0} onChange={(val) => updateActiveLayerEffect('contrast', val)} value={layerEffects[activeLayer]?.contrast || 100} />
              <FilterSlider label="Saturasi" max={300} min={0} onChange={(val) => updateActiveLayerEffect('saturation', val)} value={layerEffects[activeLayer]?.saturation || 100} />
            </div>
          </div>
        ) : (
          <div className="text-center p-4 bg-neutral-800/30 rounded-lg border border-neutral-800">
            <Info className="mx-auto text-neutral-500 mb-2" size={20} />
            <p className="text-[11px] text-neutral-400">Efek dinonaktifkan.<br/>Ubah "Target Operasi" ke salah satu layer untuk mengubah warna/rotasi.</p>
          </div>
        )}
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #404040; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
    </div>
  );
}

function ToolButton({ icon, active, onClick, tooltip }) {
  return (
    <div className="relative group flex items-center justify-center">
      <button onClick={onClick} className={`p-2.5 rounded-lg transition-all duration-200 ${active ? 'bg-teal-500 text-neutral-950 shadow-[0_0_15px_rgba(45,212,191,0.4)]' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
        {icon}
      </button>
      <div className="absolute left-full ml-3 px-2 py-1 bg-black border border-neutral-700 text-[10px] text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
        {tooltip}
      </div>
    </div>
  );
}

function FilterSlider({ label, value, min, max, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-[10px]">
        <label className="text-neutral-400">{label}</label>
        <span className="text-teal-400 font-mono">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-teal-500" />
    </div>
  );
}