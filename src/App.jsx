import React, { useState, useRef, useEffect } from 'react';
import { 
  MousePointer2, Hand, ZoomIn, Settings2, Shuffle, 
  RotateCcw, Layers, PenTool, Eraser, Trash2, Download, 
  ImagePlus, Loader2, Info, Ruler, Type, TypeIcon, Square, Move,
  LayoutGrid, PaintBucket, Copy
} from 'lucide-react';

const PATTERNS = {
  'checker-blue': { background: 'conic-gradient(#00FFFF 90deg, #ffffff 90deg 180deg, #00FFFF 180deg 270deg, #ffffff 270deg)', backgroundSize: '24px 24px' },
  'checker-black': { background: 'conic-gradient(#111111 90deg, #ffffff 90deg 180deg, #111111 180deg 270deg, #ffffff 270deg)', backgroundSize: '30px 30px' },
  'stripes-black': { backgroundImage: 'repeating-linear-gradient(45deg, #111111 0, #111111 10px, #ffffff 10px, #ffffff 20px)' },
  'dots-red': { backgroundImage: 'radial-gradient(#EC4899 20%, transparent 20%), radial-gradient(#EC4899 20%, transparent 20%)', backgroundColor: '#ffffff', backgroundPosition: '0 0, 10px 10px', backgroundSize: '20px 20px' },
  'solid-white': { background: '#ffffff' },
  'solid-black': { background: '#050505' }
};

export default function App() {
  const [images, setImages] = useState({ bg: null, fg1: null, fg2: null });
  const [layerModes, setLayerModes] = useState({ fg1: 'image', fg2: 'image' }); 
  const [layerPatterns, setLayerPatterns] = useState({ fg1: 'checker-blue', fg2: 'stripes-black' });
  const [layerColors, setLayerColors] = useState({ fg1: '#00FFFF', fg2: '#EC4899' }); 

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
    fg1: { x: 0, y: 0, scale: 1.5, rotate: 0 },
    fg2: { x: 0, y: 0, scale: 1.5, rotate: 0 },
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea') return;
      const key = e.key.toLowerCase();
      if (key === 'v') setActiveTool('select');
      else if (key === 'h') setActiveTool('grab');
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
          newCells[id] = { layer: isFg2 ? 2 : 1, col, row, spanX: 1, spanY: 1 };
        }
      }
    }
    setActiveCells(newCells);
  };
  
  useEffect(() => { generateRandomGrid(); }, []);
  const clearGrid = () => { setActiveCells({}); setSelectedCellKey(null); setBrushTemplate(null); };

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

    if (activeTool === 'grab') {
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } 
    else if (activeTool === 'draw') {
      const { x, y } = getWorkspaceCoords(e.clientX, e.clientY);
      const col = Math.floor(x / (cellWidth + gridGap));
      const row = Math.floor(y / (cellHeight + gridGap));
      
      if (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
        const newKey = `draw-${Date.now()}-${Math.random()}`;
        
        if (brushTemplate) {
           setActiveCells(prev => ({ 
             ...prev, 
             [newKey]: { layer: activeLayer === 'fg1' ? 1 : 2, col, row, spanX: 1, spanY: 1, customW: brushTemplate.w, customH: brushTemplate.h } 
           }));
        } else {
           setActiveCells(prev => ({ 
             ...prev, 
             [newKey]: { layer: activeLayer === 'fg1' ? 1 : 2, col, row, spanX: brushSpan.x, spanY: brushSpan.y } 
           }));
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
      const newText = { id: Date.now().toString(), text: 'RBA SYSTEM', x: coords.x, y: coords.y, fontSize: 32, color: '#00FFFF', fontWeight: 'bold' };
      setTexts(prev => [...prev, newText]);
      setActiveTextId(newText.id);
      setActiveTool('select'); 
    }
  };

  const handlePointerMove = (e) => {
    if (e.buttons === 0) {
      if (isDragging.current || isResizingCell.current || isMovingCell.current || draggingTextId || draggingGuide) {
        handlePointerUp(e);
      }
      return;
    }

    const { x: mouseX, y: mouseY } = getWorkspaceCoords(e.clientX, e.clientY);

    if (isResizingCell.current && resizeState.current !== null) {
      const state = resizeState.current;
      const deltaX = mouseX - state.mouseX;
      const deltaY = mouseY - state.mouseY;
      
      let newX = state.startX; let newY = state.startY;
      let newW = state.startW; let newH = state.startH;

      if (state.direction.includes('e')) newW = Math.max(10, state.startW + deltaX);
      if (state.direction.includes('s')) newH = Math.max(10, state.startH + deltaY);
      if (state.direction.includes('w')) {
        const clampedDelta = Math.min(deltaX, state.startW - 10);
        newX = state.startX + clampedDelta;
        newW = state.startW - clampedDelta;
      }
      if (state.direction.includes('n')) {
        const clampedDelta = Math.min(deltaY, state.startH - 10);
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

    if (isDragging.current && activeTool === 'grab') {
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      const targetTransform = activeLayer === 'canvas' ? 'canvas' : activeLayer;
      const adjustment = targetTransform !== 'canvas' ? (1 / transforms.canvas.scale) : 1;
      setTransforms(prev => ({
        ...prev,
        [targetTransform]: {
          ...prev[targetTransform],
          x: prev[targetTransform].x + (deltaX * adjustment),
          y: prev[targetTransform].y + (deltaY * adjustment)
        }
      }));
      return;
    }

    if (activeTool === 'draw') {
      const col = Math.floor(mouseX / (cellWidth + gridGap));
      const row = Math.floor(mouseY / (cellHeight + gridGap));
      if (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
        const isOverlap = Object.values(activeCells).some(c => c.col === col && c.row === row && c.layer === (activeLayer === 'fg1' ? 1 : 2) && c.customX === undefined);
        if (!isOverlap) {
          const newKey = `draw-${Date.now()}-${Math.random()}`;
          if (brushTemplate) {
             setActiveCells(prev => ({ ...prev, [newKey]: { layer: activeLayer === 'fg1' ? 1 : 2, col, row, spanX: 1, spanY: 1, customW: brushTemplate.w, customH: brushTemplate.h } }));
          } else {
             setActiveCells(prev => ({ ...prev, [newKey]: { layer: activeLayer === 'fg1' ? 1 : 2, col, row, spanX: brushSpan.x, spanY: brushSpan.y } }));
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
      ...prev,
      [targetTransform]: { ...prev[targetTransform], scale: Math.max(0.1, prev[targetTransform].scale + zoomFactor) }
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
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve({
              url: canvas.toDataURL('image/jpeg', 0.85),
              finalWidth: width,
              finalHeight: height
            });
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    };

    try {
      const { url, finalWidth, finalHeight } = await processAndCompress(file);
      if (layer === 'bg') {
        setCanvasSize({ w: finalWidth, h: finalHeight });
      }
      setImages(prev => {
        const newImages = { ...prev, [layer]: url };
        if (layer === 'bg' && !prev.fg1) newImages.fg1 = url;
        if (layer === 'bg' && !prev.fg2) newImages.fg2 = url;
        return newImages;
      });
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
    setShowRulers(false); 
    setShowGridHelper(false);
    setActiveTextId(null); 
    setSelectedCellKey(null); 
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
      setShowRulers(prevRulerState);
      setShowGridHelper(prevGridHelperState);
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
  else if (activeTool === 'zoom') workspaceCursor = 'zoom-in'; 
  else if (activeTool === 'draw') workspaceCursor = (activeLayer === 'fg1' || activeLayer === 'fg2') ? 'crosshair' : 'not-allowed';
  else if (activeTool === 'erase') workspaceCursor = (activeLayer === 'fg1' || activeLayer === 'fg2') ? 'cell' : 'not-allowed';
  else if (activeTool === 'text') workspaceCursor = 'text';

  const activeTextNode = texts.find(t => t.id === activeTextId);
  const activeSelectedCell = activeCells[selectedCellKey];

  return (
    <div className="flex h-screen w-full bg-[#050505] text-[#e5e5e5] font-sans overflow-hidden">
      
      {/* --- LEFT TOOLBAR --- */}
      <div className="w-16 bg-[#0a0a0a] border-r border-[#222] flex flex-col items-center py-4 gap-3 z-30 shadow-[5px_0_15px_rgba(0,0,0,0.8)] flex-shrink-0">
        <div className="text-[10px] font-bold text-[#00FFFF] mb-2 tracking-widest text-center" style={{fontFamily: "'Space Mono', monospace"}}>TTS V6<br/><span className="text-[8px] text-[#888]">FINAL</span></div>
        
        <ToolButton icon={<MousePointer2 size={18} />} active={activeTool === 'select'} onClick={() => setActiveTool('select')} tooltip="Pilih / Transform (V)" />
        <ToolButton icon={<Hand size={18} />} active={activeTool === 'grab'} onClick={() => setActiveTool('grab')} tooltip="Geser Kanvas/Foto (H)" />
        <ToolButton icon={<ZoomIn size={18} />} active={activeTool === 'zoom'} onClick={() => setActiveTool('zoom')} tooltip="Zoom (Z / Scroll)" />
        <ToolButton icon={<Type size={18} />} active={activeTool === 'text'} onClick={() => setActiveTool('text')} tooltip="Tambah Teks (T)" />
        
        <div className="w-8 h-px bg-[#222] my-1"></div>

        <ToolButton icon={<PenTool size={18} />} active={activeTool === 'draw'} onClick={() => setActiveTool('draw')} tooltip="Gambar Grid (P)" />
        <ToolButton icon={<Eraser size={18} />} active={activeTool === 'erase'} onClick={() => setActiveTool('erase')} tooltip="Hapus Grid (E)" />
        
        <div className="w-8 h-px bg-[#222] my-1"></div>
        
        <ToolButton icon={<Ruler size={18} />} active={showRulers} onClick={() => setShowRulers(!showRulers)} tooltip="Tampilkan Penggaris" />
        <ToolButton icon={<LayoutGrid size={18} />} active={showGridHelper} onClick={() => setShowGridHelper(!showGridHelper)} tooltip="Garis Bantu Grid (G)" />
      </div>

      {/* --- MAIN VIEWPORT --- */}
      <div 
        ref={viewportRef}
        className="flex-1 relative flex items-center justify-center bg-[#050505] overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="absolute top-4 left-6 bg-[#0a0a0a]/90 px-3 py-2 rounded-lg border border-white/10 flex items-center gap-2 text-sm z-40 shadow-xl backdrop-blur-md">
          <Layers size={16} className="text-[#00FFFF]" />
          <span className="text-[#ccc] text-xs" style={{fontFamily: "'Space Mono', monospace"}}>Target Operasi:</span>
          <select 
            className="bg-[#111] text-white font-bold outline-none cursor-pointer rounded px-2 py-1 text-xs border border-[#333] focus:border-[#00FFFF]"
            value={activeLayer}
            onChange={(e) => setActiveLayer(e.target.value)}
          >
            <option value="canvas">🔍 Tampilan Kanvas (Global)</option>
            <option value="bg">🖼️ Latar Belakang</option>
            <option value="fg1">🔲 Grid Frame 1 (Cyan)</option>
            <option value="fg2">🔲 Grid Frame 2 (Magenta)</option>
          </select>
        </div>

        {errorMessage && (
          <div className="absolute top-4 right-4 bg-red-900/90 border border-red-500 px-4 py-2 rounded text-red-200 text-sm z-50 flex items-center gap-2 shadow-lg animate-pulse">
            <Info size={16} /> {errorMessage}
          </div>
        )}

        {showRulers && !isExporting && (
          <>
            <div className="absolute top-0 left-0 w-full h-5 bg-[#0a0a0a]/90 border-b border-[#222] z-30 cursor-row-resize" style={{ backgroundImage: 'repeating-linear-gradient(to right, transparent, transparent 9px, #555 9px, #555 10px)' }} data-ruler="top" onPointerDown={() => setDraggingGuide('new_h')}></div>
            <div className="absolute top-0 left-0 h-full w-5 bg-[#0a0a0a]/90 border-r border-[#222] z-30 cursor-col-resize" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 9px, #555 9px, #555 10px)' }} data-ruler="left" onPointerDown={() => setDraggingGuide('new_v')}></div>
          </>
        )}

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
              border: borderWidth > 0 ? `${borderWidth}px solid rgba(255,255,255,0.2)` : 'none' 
            }}
          >
            {!images.bg && !images.fg1 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#555] pointer-events-none">
                <ImagePlus size={48} className="mb-3 opacity-30" />
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
                style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gridTemplateRows: `repeat(${gridRows}, 1fr)`, gap: `${gridGap}px`, padding: borderWidth > 0 ? `${borderWidth}px` : 0 }}
              >
                {Array.from({ length: gridCols * gridRows }).map((_, i) => (
                  <div key={`wireframe-${i}`} className="border-[0.5px] border-white/30 border-dashed mix-blend-difference" />
                ))}
              </div>
            )}

            <div className="absolute inset-0 pointer-events-none">
              {Object.entries(activeCells).map(([key, cellData]) => {
                const layerId = cellData.layer;
                const isActive = true;
                
                const lName = layerId === 1 ? 'fg1' : 'fg2';
                const isPatternMode = layerModes[lName] === 'pattern';
                const isSolidMode = layerModes[lName] === 'solid'; 
                const activeImage = images[lName];
                const activeTransform = transforms[lName];
                const activeFilter = getFilterString(lName);
                const activeBlendMode = layerEffects[lName]?.blendMode || 'normal'; 
                const isSelected = selectedCellKey === key && activeTool === 'select' && !isExporting;

                const posX = cellData.customX !== undefined ? cellData.customX : cellData.col * (cellWidth + gridGap);
                const posY = cellData.customY !== undefined ? cellData.customY : cellData.row * (cellHeight + gridGap);
                const calcW = Math.max(1, cellData.customW !== undefined ? cellData.customW : (cellData.spanX * cellWidth + (cellData.spanX - 1) * gridGap));
                const calcH = Math.max(1, cellData.customH !== undefined ? cellData.customH : (cellData.spanY * cellHeight + (cellData.spanY - 1) * gridGap));
                
                return (
                  <div 
                    key={key} 
                    data-cell-key={key}
                    className={`absolute box-border pointer-events-auto
                      ${isActive && enableShadow ? 'shadow-[0_4px_15px_rgba(0,0,0,0.9)]' : ''} 
                      ${isSelected ? 'z-[100] overflow-visible cursor-move' : 'z-20 overflow-hidden cursor-pointer'}
                    `}
                    style={{ 
                      left: posX, top: posY, width: calcW, height: calcH,
                      border: isActive && borderWidth > 0 ? `${borderWidth}px solid rgba(255, 255, 255, 0.85)` : 'none',
                      mixBlendMode: activeBlendMode
                    }}
                  >
                    {isActive && (
                      <>
                        <div 
                          className="absolute pointer-events-none transition-opacity duration-200"
                          style={{
                            width: canvasSize.w, height: canvasSize.h,
                            left: -posX - (borderWidth), 
                            top: -posY - (borderWidth),
                            filter: activeFilter,
                            clipPath: isSelected ? 'none' : undefined,
                            opacity: isSelected ? 0.75 : 1 
                          }}
                        >
                          {!isPatternMode && !isSolidMode && activeImage && (
                            <img 
                              src={activeImage} alt="Grid Content" draggable="false" className="w-full h-full object-cover origin-center select-none"
                              style={{ transform: `translate(${activeTransform.x}px, ${activeTransform.y}px) scale(${activeTransform.scale}) rotate(${activeTransform.rotate || 0}deg)` }}
                            />
                          )}
                          {isPatternMode && (
                            <div 
                              className="w-full h-full"
                              style={{ ...PATTERNS[layerPatterns[lName]], transform: `translate(${activeTransform.x}px, ${activeTransform.y}px) scale(${activeTransform.scale}) rotate(${activeTransform.rotate || 0}deg)` }}
                            />
                          )}
                          {isSolidMode && (
                            <div className="w-full h-full" style={{ backgroundColor: layerColors[lName] }} />
                          )}
                        </div>

                        {isSelected && (
                          <div className="absolute inset-0 border-[2px] border-[#00FFFF] z-50 pointer-events-none shadow-[0_0_15px_rgba(0,255,255,0.7)]">
                            <div data-resize-handle={`${key}|nw`} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-[1.5px] border-[#00FFFF] cursor-nwse-resize pointer-events-auto shadow-sm" />
                            <div data-resize-handle={`${key}|ne`} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-[1.5px] border-[#00FFFF] cursor-nesw-resize pointer-events-auto shadow-sm" />
                            <div data-resize-handle={`${key}|sw`} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-[1.5px] border-[#00FFFF] cursor-nesw-resize pointer-events-auto shadow-sm" />
                            <div data-resize-handle={`${key}|se`} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-[1.5px] border-[#00FFFF] cursor-nwse-resize pointer-events-auto shadow-sm" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {texts.map(t => (
              <div
                key={t.id} data-text-id={t.id}
                className={`absolute select-none whitespace-pre-wrap leading-tight z-40
                  ${activeTextId === t.id && !isExporting ? 'outline outline-2 outline-[#00FFFF] outline-offset-4 cursor-move' : ''}
                  ${activeTool === 'select' ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-[#00FFFF]/50' : 'pointer-events-none'}
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
                className={`absolute bg-[#00FFFF] shadow-[0_0_4px_rgba(0,255,255,0.8)] z-50 transition-colors
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
      <div className="w-[340px] bg-[#0a0a0a] border-l border-[#222] p-5 flex flex-col gap-6 overflow-y-auto z-20 flex-shrink-0 custom-scrollbar shadow-[-5px_0_15px_rgba(0,0,0,0.8)]">
        
        {/* EXPORT */}
        <div className="bg-[#111] p-4 rounded-xl border border-white/5 shadow-inner">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2 text-xs" style={{fontFamily: "'Space Mono', monospace"}}>
            <Download size={14} className="text-[#00FFFF]" /> EXPORT HI-RES
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={isExporting} onClick={() => exportImage('jpg')} className="py-2 bg-[#222] hover:bg-[#333] text-white rounded text-xs font-semibold transition-colors disabled:opacity-50 border border-white/5">
              {isExporting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'JPG'}
            </button>
            <button disabled={isExporting} onClick={() => exportImage('png')} className="py-2 bg-[#00FFFF] hover:bg-cyan-400 text-black rounded text-xs font-bold transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(0,255,255,0.4)] border border-[#00FFFF]">
              {isExporting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'PNG'}
            </button>
          </div>
        </div>

        {/* MENU KLONING SIMPLE & BERSIH */}
        {activeSelectedCell && (
          <div className="bg-[#111] p-3 rounded-lg border border-[#00FFFF]/30 shadow-[0_0_10px_rgba(0,255,255,0.1)]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#00FFFF] rounded-full animate-pulse"></span>
                <span className="text-[#00FFFF] font-bold text-[11px] tracking-wider" style={{fontFamily: "'Space Mono', monospace"}}>KOTAK TERPILIH</span>
              </div>
              <button onClick={() => {
                setActiveCells(p => { const n = {...p}; delete n[selectedCellKey]; return n; });
                setSelectedCellKey(null);
              }} className="text-red-400 hover:text-red-300 text-[10px]"><Trash2 size={14}/></button>
            </div>
            
            <div className="mt-3">
              <button 
                onClick={() => {
                  const w = activeSelectedCell.customW !== undefined ? activeSelectedCell.customW : (activeSelectedCell.spanX * cellWidth + (activeSelectedCell.spanX - 1) * gridGap);
                  const h = activeSelectedCell.customH !== undefined ? activeSelectedCell.customH : (activeSelectedCell.spanY * cellHeight + (activeSelectedCell.spanY - 1) * gridGap);
                  setBrushTemplate({w, h});
                  setActiveTool('draw'); 
                }} 
                className="w-full py-2 bg-[#00FFFF] hover:bg-cyan-400 text-black rounded text-xs font-bold flex justify-center items-center gap-2 transition-colors shadow-sm"
              >
                <Copy size={14} /> Salin Kustom Kuas
              </button>
            </div>
          </div>
        )}

        {/* KANVAS & LATAR BELAKANG */}
        <div>
          <h3 className="text-[#888] font-bold mb-3 text-[11px] tracking-wider flex items-center gap-1" style={{fontFamily: "'Space Mono', monospace"}}><Square size={14}/> KANVAS & LATAR</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#555]">Lebar (W)</label>
              <input type="number" value={canvasSize.w} onChange={(e) => setCanvasSize(p => ({...p, w: Number(e.target.value)}))} className="bg-[#111] text-white text-xs rounded p-2 outline-none border border-[#222]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#555]">Tinggi (H)</label>
              <input type="number" value={canvasSize.h} onChange={(e) => setCanvasSize(p => ({...p, h: Number(e.target.value)}))} className="bg-[#111] text-white text-xs rounded p-2 outline-none border border-[#222]" />
            </div>
          </div>
          <div className="flex items-center justify-between bg-[#111] p-2 rounded border border-[#222]">
            <span className="text-[10px] text-[#888]">Warna Dasar Latar</span>
            <input type="color" value={canvasBgColor} onChange={(e) => setCanvasBgColor(e.target.value)} className="w-8 h-8 bg-transparent rounded cursor-pointer border-none p-0" />
          </div>
        </div>

        <div className="h-px bg-[#222]"></div>

        {/* UPLOADS, PATTERNS & SOLID COLORS */}
        <div>
          <h3 className="text-[#888] font-bold mb-3 text-[11px] tracking-wider" style={{fontFamily: "'Space Mono', monospace"}}>3 LAPISAN (LAYER)</h3>
          <div className="space-y-3">
            {/* BG */}
            <div className="bg-[#111] p-2 rounded border border-[#222] border-l-2 border-l-white">
              <label className="text-[10px] text-white block mb-1">Layer Dasar (Latar)</label>
              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'bg')} className="w-full text-[10px] text-[#888] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-[#222] file:text-white cursor-pointer" />
            </div>
            
            {/* FG1 */}
            <div className="bg-[#111] p-2 rounded border border-[#222] border-l-2 border-l-[#00FFFF]">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-[#00FFFF]">Grid Frame 1</label>
                <select value={layerModes.fg1} onChange={(e) => setLayerModes(p => ({...p, fg1: e.target.value}))} className="bg-[#222] text-[9px] text-white rounded px-1 outline-none border border-[#333]">
                  <option value="image">Gunakan Foto</option>
                  <option value="pattern">Gunakan Pola</option>
                  <option value="solid">Warna Solid (Neon)</option>
                </select>
              </div>
              {layerModes.fg1 === 'image' ? (
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'fg1')} className="w-full text-[10px] text-[#888] cursor-pointer file:bg-[#222] file:text-[#00FFFF] file:border-0 file:rounded file:px-2 file:mr-2" />
              ) : layerModes.fg1 === 'pattern' ? (
                <select value={layerPatterns.fg1} onChange={(e) => setLayerPatterns(p => ({...p, fg1: e.target.value}))} className="w-full bg-[#222] text-xs text-white p-1 rounded outline-none border border-[#333]">
                  <option value="checker-blue">Catur Biru Muda</option><option value="checker-black">Catur Hitam Putih</option><option value="stripes-black">Garis Diagonal</option><option value="dots-red">Titik Merah (Halftone)</option><option value="solid-white">Blok Putih Solid</option>
                </select>
              ) : (
                <div className="flex items-center justify-between bg-[#222] p-1.5 rounded border border-[#333]">
                   <span className="text-[10px] text-white flex items-center gap-1"><PaintBucket size={12}/> Pilih Warna Solid:</span>
                   <input type="color" value={layerColors.fg1} onChange={(e) => setLayerColors(p => ({...p, fg1: e.target.value}))} className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent" />
                </div>
              )}
            </div>

            {/* FG2 */}
            <div className="bg-[#111] p-2 rounded border border-[#222] border-l-2 border-l-[#EC4899]">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-[#EC4899]">Grid Frame 2</label>
                <select value={layerModes.fg2} onChange={(e) => setLayerModes(p => ({...p, fg2: e.target.value}))} className="bg-[#222] text-[9px] text-white rounded px-1 outline-none border border-[#333]">
                  <option value="image">Gunakan Foto</option>
                  <option value="pattern">Gunakan Pola</option>
                  <option value="solid">Warna Solid (Neon)</option>
                </select>
              </div>
              {layerModes.fg2 === 'image' ? (
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'fg2')} className="w-full text-[10px] text-[#888] cursor-pointer file:bg-[#222] file:text-[#EC4899] file:border-0 file:rounded file:px-2 file:mr-2" />
              ) : layerModes.fg2 === 'pattern' ? (
                <select value={layerPatterns.fg2} onChange={(e) => setLayerPatterns(p => ({...p, fg2: e.target.value}))} className="w-full bg-[#222] text-xs text-white p-1 rounded outline-none border border-[#333]">
                  <option value="checker-blue">Catur Biru Muda</option><option value="checker-black">Catur Hitam Putih</option><option value="stripes-black">Garis Diagonal</option><option value="dots-red">Titik Merah (Halftone)</option><option value="solid-white">Blok Putih Solid</option>
                </select>
              ) : (
                <div className="flex items-center justify-between bg-[#222] p-1.5 rounded border border-[#333]">
                   <span className="text-[10px] text-white flex items-center gap-1"><PaintBucket size={12}/> Pilih Warna Solid:</span>
                   <input type="color" value={layerColors.fg2} onChange={(e) => setLayerColors(p => ({...p, fg2: e.target.value}))} className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-[#222]"></div>

        {/* TYPOGRAPHY */}
        <div>
          <h3 className="text-[#888] font-bold mb-3 text-[11px] tracking-wider flex items-center gap-1" style={{fontFamily: "'Space Mono', monospace"}}><TypeIcon size={14}/> TIPOGRAFI & TEKS</h3>
          {activeTextNode ? (
            <div className="bg-[#111] p-3 rounded-lg border border-[#00FFFF]/50 space-y-3 shadow-[0_0_10px_rgba(0,255,255,0.1)]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[#00FFFF] font-bold" style={{fontFamily: "'Space Mono', monospace"}}>EDIT TEKS TERPILIH</span>
                <button onClick={deleteActiveText} className="text-red-400 hover:text-red-300 text-[10px]"><Trash2 size={12}/></button>
              </div>
              <textarea value={activeTextNode.text} onChange={(e) => updateActiveText('text', e.target.value)} className="w-full bg-[#050505] text-white text-xs p-2 rounded border border-[#333] outline-none focus:border-[#00FFFF] min-h-[60px]" placeholder="Ketik teks disini..." />
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-[#555]">Ukuran (px)</label>
                  <input type="number" value={activeTextNode.fontSize} onChange={(e) => updateActiveText('fontSize', Number(e.target.value))} className="bg-[#050505] text-white text-xs p-1.5 rounded border border-[#333]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-[#555]">Warna</label>
                  <input type="color" value={activeTextNode.color} onChange={(e) => updateActiveText('color', e.target.value)} className="w-full h-7 bg-[#050505] rounded border border-[#333] cursor-pointer" />
                </div>
              </div>
              <button onClick={() => updateActiveText('fontWeight', activeTextNode.fontWeight === 'bold' ? 'normal' : 'bold')} className={`w-full py-1 text-xs rounded border ${activeTextNode.fontWeight === 'bold' ? 'bg-[#00FFFF] border-[#00FFFF] text-black font-bold' : 'bg-[#222] border-[#333] text-[#888]'}`}>Bold</button>
            </div>
          ) : (
            <div className="bg-[#111] p-3 rounded text-center border border-[#222]">
              <p className="text-[10px] text-[#555] mb-2">Pilih alat 'T' atau klik teks di kanvas.</p>
              <button onClick={() => { setActiveTool('text'); showError("Klik di kanvas untuk menaruh teks."); }} className="w-full py-1.5 bg-[#222] hover:bg-[#333] text-white rounded text-xs transition-colors border border-[#333]">+ Tambah Teks Baru</button>
            </div>
          )}
        </div>

        <div className="h-px bg-[#222]"></div>

        {/* DRAW SETTINGS */}
        <div>
          <h3 className="text-[#888] font-bold mb-3 text-[11px] tracking-wider flex justify-between items-center" style={{fontFamily: "'Space Mono', monospace"}}>
            GRID & KUAS
          </h3>

          <div className="mb-4 bg-[#111] p-3 rounded-lg border border-[#333]">
            <h4 className="text-[10px] text-[#00FFFF] font-bold mb-2 flex items-center gap-1"><PenTool size={12}/> ALAT KUAS (DRAW)</h4>
            
            {brushTemplate ? (
              <div className="bg-[#0a0a0a] p-2.5 rounded border border-[#00FFFF]/50 flex justify-between items-center">
                <div>
                  <span className="text-[9px] text-[#00FFFF] block mb-0.5">Template Kustom Aktif:</span>
                  <span className="text-xs text-white font-bold tracking-wider">{Math.round(brushTemplate.w)}px <span className="text-[#00FFFF] font-normal">x</span> {Math.round(brushTemplate.h)}px</span>
                </div>
                <button onClick={() => setBrushTemplate(null)} className="p-1.5 bg-red-950 text-red-400 rounded border border-red-900/50 hover:bg-red-900 hover:text-white transition-colors" title="Hapus Template">
                  <Trash2 size={12}/>
                </button>
              </div>
            ) : (
              <>
                <p className="text-[9px] text-[#555] mb-3 leading-relaxed">Pilih kotak mana saja lalu klik <b>"Salin Template"</b> untuk merekam bentuknya.</p>
                <FilterSlider label="Lebar Kotak Standar (X)" value={brushSpan.x} min={1} max={15} onChange={(v) => setBrushSpan(p => ({...p, x: v}))} />
                <div className="h-2"></div>
                <FilterSlider label="Tinggi Kotak Standar (Y)" value={brushSpan.y} min={1} max={15} onChange={(v) => setBrushSpan(p => ({...p, y: v}))} />
              </>
            )}
          </div>

          <div className="space-y-4 mb-4">
            <FilterSlider label="Celah Antar Kotak (Gap)" value={gridGap} min={0} max={40} onChange={setGridGap} />
            <FilterSlider label="Ketebalan Garis Batas" value={borderWidth} min={0} max={5} onChange={setBorderWidth} />
            <div className="flex items-center justify-between bg-[#111] p-2 rounded border border-[#222]">
              <span className="text-[11px] text-[#888]">Bayangan Kotak (Shadow)</span>
              <button onClick={() => setEnableShadow(!enableShadow)} className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${enableShadow ? 'bg-[#00FFFF]' : 'bg-[#333]'}`}>
                <div className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-300 ${enableShadow ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[#555]">Kolom (Max 250)</label>
              <input type="number" min="2" max="250" value={gridCols} onChange={(e) => setGridCols(Number(e.target.value))} className="bg-[#111] text-white text-xs rounded p-2 outline-none border border-[#222]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[#555]">Baris (Max 250)</label>
              <input type="number" min="2" max="250" value={gridRows} onChange={(e) => setGridRows(Number(e.target.value))} className="bg-[#111] text-white text-xs rounded p-2 outline-none border border-[#222]" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={generateRandomGrid} className="flex-1 py-2 bg-[#222] hover:bg-[#333] text-white border border-[#333] rounded text-xs transition-colors flex justify-center gap-1"><Shuffle size={14} /> Acak</button>
            <button onClick={clearGrid} className="flex-1 py-2 bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-900/30 rounded text-xs transition-colors flex justify-center gap-1"><Trash2 size={14} /> Kosongkan</button>
          </div>
        </div>

        <div className="h-px bg-[#222]"></div>

        {/* LAYER-SPECIFIC CONTROLS */}
        {activeLayer !== 'canvas' ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-white font-bold text-[11px] tracking-wider uppercase" style={{fontFamily: "'Space Mono', monospace"}}>PENGATURAN {activeLayer}</h3>
            </div>

            <div className="flex flex-col gap-1 mb-4">
              <label className="text-[11px] text-[#555]">Blend Mode (Pencampuran)</label>
              <select 
                value={layerEffects[activeLayer]?.blendMode || 'normal'} 
                onChange={(e) => updateActiveLayerEffect('blendMode', e.target.value)} 
                className="bg-[#111] border border-[#222] text-white text-xs rounded p-2 outline-none focus:border-[#00FFFF]"
              >
                <option value="normal">Normal</option>
                <option value="multiply">Multiply (Gelap)</option>
                <option value="screen">Screen (Terang)</option>
                <option value="overlay">Overlay (Kontras)</option>
                <option value="color-dodge">Color Dodge (Neon Glow)</option>
                <option value="difference">Difference (Invert)</option>
              </select>
            </div>

            <div className="mb-4 bg-[#111] p-3 rounded-lg border border-[#222]">
              <FilterSlider label="Rotasi Gambar (°)" value={transforms[activeLayer]?.rotate || 0} min={-180} max={180} onChange={(val) => updateActiveLayerTransform('rotate', val)} />
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-[#555]">Tema Spesial</label>
                <select value={layerEffects[activeLayer]?.specialEffect || 'none'} onChange={(e) => updateActiveLayerEffect('specialEffect', e.target.value)} className="bg-[#111] border border-[#222] text-white text-xs rounded p-2 outline-none focus:border-[#00FFFF]">
                  <option value="none">Normal</option>
                  <option value="cyberpunk">Cyberpunk (Neon)</option>
                  <option value="matrix">The Matrix (Hijau)</option>
                  <option value="sepia">Vintage (Sepia)</option>
                  <option value="negative">Invert Negatif</option>
                  <option value="xray">X-Ray Scanner</option>
                  <option value="dither">Dither Kasar</option>
                </select>
              </div>
              <FilterSlider label="Kecerahan" value={layerEffects[activeLayer]?.brightness || 100} min={0} max={200} onChange={(val) => updateActiveLayerEffect('brightness', val)} />
              <FilterSlider label="Kontras" value={layerEffects[activeLayer]?.contrast || 100} min={0} max={200} onChange={(val) => updateActiveLayerEffect('contrast', val)} />
              <FilterSlider label="Saturasi" value={layerEffects[activeLayer]?.saturation || 100} min={0} max={300} onChange={(val) => updateActiveLayerEffect('saturation', val)} />
            </div>
          </div>
        ) : (
          <div className="text-center p-4 bg-[#111] rounded-lg border border-[#222]">
            <Info className="mx-auto text-[#555] mb-2" size={20} />
            <p className="text-[11px] text-[#888]">Efek dinonaktifkan.<br/>Ubah "Target Operasi" ke salah satu layer untuk mengubah warna/rotasi.</p>
          </div>
        )}
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
    </div>
  );
}

function ToolButton({ icon, active, onClick, tooltip }) {
  return (
    <div className="relative group flex items-center justify-center">
      <button onClick={onClick} className={`p-2.5 rounded-lg transition-all duration-200 ${active ? 'bg-[#00FFFF] text-black shadow-[0_0_15px_rgba(0,255,255,0.4)]' : 'text-[#888] hover:text-white hover:bg-[#222]'}`}>
        {icon}
      </button>
      <div className="absolute left-full ml-3 px-2 py-1 bg-black border border-[#333] text-[10px] text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
        {tooltip}
      </div>
    </div>
  );
}

function FilterSlider({ label, value, min, max, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-[10px]">
        <label className="text-[#888]">{label}</label>
        <span className="text-[#00FFFF]" style={{fontFamily: "'Space Mono', monospace"}}>{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-[#00FFFF]" />
    </div>
  );
}
```
eof

### 2. Update File Grid Tools
Buka folder `GRIDTOOLS`, lalu buka file `src/App.jsx`. Timpa seluruh isinya dengan kode ini:

```react:Update UI Grid Tools:src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';

function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const Ruler = ({ type, pan, zoom, length }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !length) return;
        const ctx = canvas.getContext('2d');
        const isH = type === 'h';
        
        canvas.width = isH ? length : 24;
        canvas.height = isH ? 24 : length;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#050505'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#10B981'; 
        ctx.strokeStyle = '#222222'; 
        ctx.font = '9px "Space Mono", monospace';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 1;

        const center = length / 2;
        const panOffset = isH ? pan.x : pan.y;
        
        let step = 10;
        if (zoom < 0.5) step = 20;
        if (zoom < 0.2) step = 50;
        if (zoom < 0.1) step = 100;
        if (zoom > 2) step = 5;
        if (zoom > 5) step = 1;

        const startCanvasPos = (0 - center - panOffset) / zoom;
        const endCanvasPos = (length - center - panOffset) / zoom;
        const start = Math.floor(startCanvasPos / step) * step;
        const end = Math.ceil(endCanvasPos / step) * step;

        ctx.beginPath();
        for (let val = start; val <= end; val += step) {
            const screenPos = Math.round(center + panOffset + (val * zoom)) + 0.5; 
            
            let tickLen = 4;
            const isMajor = Math.abs(val) % (step * 10) === 0 || val === 0;
            const isMid = Math.abs(val) % (step * 5) === 0;

            if (isMajor) tickLen = 12;
            else if (isMid) tickLen = 8;

            const x = isH ? screenPos : 24 - tickLen;
            const y = isH ? 24 - tickLen : screenPos;
            const ex = isH ? screenPos : 24;
            const ey = isH ? 24 : screenPos;

            ctx.moveTo(x, y);
            ctx.lineTo(ex, ey);

            if (isMajor) {
                ctx.save();
                if (isH) {
                    ctx.fillText(val.toString(), screenPos + 3, 2);
                } else {
                    ctx.translate(2, screenPos - 3);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillText(val.toString(), 0, 0);
                }
                ctx.restore();
            }
        }
        ctx.stroke();
    }, [type, pan, zoom, length]);

    return (
        <canvas 
            ref={canvasRef} 
            className={`absolute top-0 left-0 w-full h-full ${type === 'h' ? 'cursor-row-resize' : 'cursor-col-resize'}`} 
        />
    );
};

export default function App() {
  const [image, setImage] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [seed, setSeed] = useState(12345);
  
  const [activeTool, setActiveTool] = useState('pan'); 
  const [isManualMode, setIsManualMode] = useState(false);
  const [brushSize, setBrushSize] = useState(50);
  const [viewScale, setViewScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  
  const [guides, setGuides] = useState([]);
  const [draggingGuide, setDraggingGuide] = useState(null); 

  const maskPointsRef = useRef([]); 
  const isPaintingRef = useRef(false);
  const animationFrameId = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const viewportRef = useRef(null);

  const [scale, setScale] = useState(80); 
  const [complexity, setComplexity] = useState(60); 
  const [density, setDensity] = useState(65);       
  const [stretchInt, setStretchInt] = useState(72); 
  const [brutalInt, setBrutalInt] = useState(25); 
  const [stretchDirX, setStretchDirX] = useState(true);
  const [stretchDirY, setStretchDirY] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);
  const [showTextAnnotations, setShowTextAnnotations] = useState(true);
  const [textColor, setTextColor] = useState('#00FFFF'); 
  
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [annoLang, setAnnoLang] = useState('EN'); 
  const [apiKeyInput, setApiKeyInput] = useState(''); 

  const fallbackWords = {
    'ID': ['GREEN', 'LEAF', 'NATURE', 'TEXT', 'SIMPLE', 'DESIGN', 'GRID', 'PLANT', 'BRANCH', 'FLAT', 'CLEAR', 'STRETCH'],
    'EN': ['GREEN', 'LEAF', 'NATURE', 'TEXT', 'SIMPLE', 'DESIGN', 'GRID', 'PLANT', 'BRANCH', 'FLAT', 'CLEAR', 'STRETCH'],
    'JP': ['緑', '葉', '自然', 'テキスト', 'シンプル', 'デザイン', 'グリッド', '植物', '枝', 'フラット', 'クリア', 'ストレッチ']
  };
  const [aiWords, setAiWords] = useState(fallbackWords['EN']);

  useEffect(() => {
    const updateSize = () => {
        if (viewportRef.current) {
            setViewportSize({ w: viewportRef.current.clientWidth, h: viewportRef.current.clientHeight });
        }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
  }, []);

  useEffect(() => {
     setAiWords(fallbackWords[annoLang]);
     handleRandomize();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annoLang]);

  const processFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setSeed(Math.random() * 10000); 
          maskPointsRef.current = []; 
          setViewScale(1);
          setPan({ x: 0, y: 0 });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = (e) => processFile(e.target.files[0]);
  const handleRotate = () => { setRotation((prev) => (prev + 90) % 360); maskPointsRef.current = []; };
  const handleRandomize = () => setSeed(Math.random() * 10000);
  
  const handleExport = (format) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `grid-stretch-${Date.now()}.${format}`;
    link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 1.0);
    link.click();
  };

  const handleAiAnalysis = async () => {
    if (!image) return; 
    if (!apiKeyInput || apiKeyInput.trim() === '') { alert("Please enter your GitHub Token (API Key) first."); return; }
    setIsAiAnalyzing(true);
    
    try {
        const tempCanvas = document.createElement('canvas');
        const MAX_SIZE = 600;
        let w = image.width; let h = image.height;
        if (w > MAX_SIZE || h > MAX_SIZE) { const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h); w *= ratio; h *= ratio; }
        tempCanvas.width = w; tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(image, 0, 0, w, h);
        
        const base64Data = `data:image/jpeg;base64,${tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1]}`;
        const apiKey = apiKeyInput.trim(); 
        const langMap = { 'ID': 'Indonesian', 'EN': 'English', 'JP': 'Japanese' };
        const promptText = `Analyze this image and provide exactly 12 single-word aesthetic keywords describing its main subjects, colors, or vibe. The words MUST be translated to ${langMap[annoLang]}. Return ONLY a comma-separated list of these words, in ALL CAPS (if applicable). No intro, no outro, no markdown.`;
        
        const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "gpt-4o-mini", messages: [ { role: "user", content: [ { type: "text", text: promptText }, { type: "image_url", image_url: { url: base64Data } } ] } ] })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error?.message || `API Error: ${response.status}`);
        
        let text = data.choices?.[0]?.message?.content;
        if (text) {
            text = text.replace(/`/g, '').replace(/csv/g, '').trim();
            const words = text.split(',').map(w => w.trim().toUpperCase()).filter(w => w);
            if (words.length > 0) { setAiWords(words); alert("GitHub AI Analysis Successful!"); }
        } else throw new Error("Empty response from AI.");
    } catch (err) {
        console.error("AI API Error:", err);
        alert(`Failed to analyze image via GitHub Models.\n\nError: ${err.message}`);
        setAiWords(fallbackWords[annoLang]);
    } finally { setIsAiAnalyzing(false); handleRandomize(); }
  };

  const handleWorkspacePointerDown = (e) => {
    if (!image) return;
    if (activeTool === 'pan') {
      setIsPanning(true);
      e.target.setPointerCapture(e.pointerId);
    } else if (activeTool === 'brush' && isManualMode) {
      isPaintingRef.current = true;
      e.target.setPointerCapture(e.pointerId);
      addMaskPoint(e);
    }
  };

  const handleWorkspacePointerMove = (e) => {
    if (draggingGuide) {
      e.preventDefault();
      const rect = viewportRef.current.getBoundingClientRect();
      const screenPos = draggingGuide.type === 'h' ? e.clientY - rect.top : e.clientX - rect.left;
      const center = draggingGuide.type === 'h' ? rect.height / 2 : rect.width / 2;
      const panOffset = draggingGuide.type === 'h' ? pan.y : pan.x;
      const canvasPos = (screenPos - center - panOffset) / viewScale;
      setGuides(prev => prev.map(g => g.id === draggingGuide.id ? { ...g, pos: canvasPos } : g));
    } 
    else if (isPanning) {
      setPan(prev => ({ x: prev.x + e.nativeEvent.movementX, y: prev.y + e.nativeEvent.movementY }));
    } 
    else if (isPaintingRef.current && activeTool === 'brush' && isManualMode) {
      addMaskPoint(e);
    }
  };

  const handleWorkspacePointerUp = (e) => {
    if (draggingGuide) {
      const rect = viewportRef.current.getBoundingClientRect();
      const screenPos = draggingGuide.type === 'h' ? e.clientY - rect.top : e.clientX - rect.left;
      if (screenPos < 0 || (draggingGuide.type === 'h' ? screenPos > rect.height : screenPos > rect.width)) {
          setGuides(prev => prev.filter(g => g.id !== draggingGuide.id));
      }
      setDraggingGuide(null);
    }
    if (isPanning) setIsPanning(false);
    if (isPaintingRef.current) isPaintingRef.current = false;
    e.target.releasePointerCapture(e.pointerId);
  };

  const startGuideFromRuler = (e, type) => {
    e.preventDefault();
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const screenPos = type === 'h' ? e.clientY - rect.top : e.clientX - rect.left;
    const center = type === 'h' ? rect.height / 2 : rect.width / 2;
    const panOffset = type === 'h' ? pan.y : pan.x;
    const canvasPos = (screenPos - center - panOffset) / viewScale;
    
    const newId = Date.now().toString();
    setGuides(prev => [...prev, { id: newId, type, pos: canvasPos }]);
    setDraggingGuide({ id: newId, type });
  };

  const addMaskPoint = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      maskPointsRef.current.push({ nx, ny, radius: brushSize });
      if (!animationFrameId.current) {
          animationFrameId.current = requestAnimationFrame(() => { drawCanvas(); animationFrameId.current = null; });
      }
  };

  const clearMask = () => { maskPointsRef.current = []; drawCanvas(); };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (!image) {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width || 800; canvas.height = rect.height || 600;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '24px "Space Mono", monospace'; ctx.fillStyle = '#9CA3AF';
      ctx.fillText('Please upload an image from the left panel', canvas.width/2, canvas.height/2);
      return;
    }

    const rng = mulberry32(seed);
    const isRotated = rotation % 180 !== 0;
    
    canvas.width = isRotated ? image.height : image.width;
    canvas.height = isRotated ? image.width : image.height;
    const relScale = Math.max(1, canvas.width / 1000); 
    
    ctx.imageSmoothingEnabled = brutalInt < 50; 
    ctx.fillStyle = '#FFFFFF'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width; offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');
    offCtx.fillStyle = '#FFFFFF'; offCtx.fillRect(0, 0, offscreen.width, offscreen.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scaleFactor = scale / 100; 
    const drawW = Math.floor(image.width * scaleFactor);
    const drawH = Math.floor(image.height * scaleFactor);

    offCtx.save();
    offCtx.translate(centerX, centerY);
    offCtx.rotate((rotation * Math.PI) / 180);
    offCtx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
    offCtx.restore();

    const numCols = Math.floor(10 + (complexity / 100) * 80);
    const numRows = Math.floor(10 + (complexity / 100) * 80);
    
    let xCuts = [0, canvas.width];
    for(let i = 0; i < numCols; i++) xCuts.push(Math.floor(rng() * canvas.width));
    xCuts.sort((a,b) => a - b);
    
    let yCuts = [0, canvas.height];
    for(let i = 0; i < numRows; i++) yCuts.push(Math.floor(rng() * canvas.height));
    yCuts.sort((a,b) => a - b);

    const stretchProb = Math.min(stretchInt, 100) / 100; 
    const stretchMultiplier = stretchInt > 100 ? 1 + ((stretchInt - 100) / 50) * 15 : 1;
    const pEmpty = (1 - (density / 100)) * 0.6; 
    const maxThick = Math.max(1, Math.floor((brutalInt / 100) * 20 * relScale)); 

    const checkMask = (testNX, testNY) => {
        if (maskPointsRef.current.length === 0) return false;
        const aspect = canvas.width / canvas.height;
        for (let pt of maskPointsRef.current) {
            const normRadius = (pt.radius / 100) * 0.10; 
            const dx = pt.nx - testNX; const dy = (pt.ny - testNY) / aspect; 
            if (Math.sqrt(dx*dx + dy*dy) < normRadius) return true;
        }
        return false;
    };

    const normalPass = [];
    const stretchPass = [];

    for (let i = 0; i < xCuts.length - 1; i++) {
        for (let j = 0; j < yCuts.length - 1; j++) {
            const x = xCuts[i]; const y = yCuts[j];
            const w = xCuts[i+1] - x; const h = yCuts[j+1] - y;
            if (w < 1 || h < 1) continue;

            const dstW = w + 1; const dstH = h + 1;
            const cellCenterNX = (x + w / 2) / canvas.width;
            const cellCenterNY = (y + h / 2) / canvas.height;

            let applyStretch = false;
            let applyEmpty = false;

            if (isManualMode) {
                applyStretch = checkMask(cellCenterNX, cellCenterNY);
            } else {
                const r = rng();
                if (r < pEmpty) applyEmpty = true;
                else if (r < pEmpty + stretchProb) applyStretch = true;
            }

            if (applyEmpty) {
                normalPass.push({ type: 'empty', x, y, dstW, dstH });
            } 
            else if (applyStretch) {
                let isHoriz = rng() > 0.5;
                if (!stretchDirX && stretchDirY) isHoriz = false;
                if (stretchDirX && !stretchDirY) isHoriz = true;
                const isBrutal = rng() < (brutalInt / 100);

                let sliceW = Math.max(1, Math.floor(1 * relScale * 0.5)); 
                let sliceH = Math.max(1, Math.floor(1 * relScale * 0.5)); 
                let srcX = rng() > 0.5 ? x : (x + w - sliceW); 
                let srcY = rng() > 0.5 ? y : (y + h - sliceH); 

                if (isBrutal) {
                    if (isHoriz) {
                        sliceW = Math.floor(rng() * maxThick) + 1;
                        if (sliceW > w) sliceW = w;
                        if (rng() > 0.4) srcX = x + Math.floor(rng() * (w - sliceW));
                    } else {
                        sliceH = Math.floor(rng() * maxThick) + 1;
                        if (sliceH > h) sliceH = h;
                        if (rng() > 0.4) srcY = y + Math.floor(rng() * (h - sliceH));
                    }
                }
                if(srcX < x) srcX = x;
                if(srcY < y) srcY = y;

                stretchPass.push({ isHoriz, srcX, srcY, sliceW, sliceH, x, y, w, h, dstW, dstH });
            } else {
                normalPass.push({ type: 'normal', x, y, w, h, dstW, dstH });
            }
        }
    }

    normalPass.forEach(op => {
        if (op.type === 'empty') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(op.x, op.y, op.dstW, op.dstH);
        } else {
            ctx.drawImage(offscreen, op.x, op.y, op.w, op.h, op.x, op.y, op.dstW, op.dstH);
        }
    });

    stretchPass.forEach(op => {
        if (op.isHoriz && stretchDirX) {
            const extendedW = op.dstW * stretchMultiplier;
            ctx.drawImage(offscreen, op.srcX, op.y, op.sliceW, op.h, op.x, op.y, extendedW, op.dstH);
        } else if (!op.isHoriz && stretchDirY) {
            const extendedH = op.dstH * stretchMultiplier;
            ctx.drawImage(offscreen, op.x, op.srcY, op.w, op.sliceH, op.x, op.y, op.dstW, extendedH);
        } else {
            ctx.drawImage(offscreen, op.x, op.y, op.w, op.h, op.x, op.y, op.dstW, op.dstH);
        }
    });

    if (showGridLines) {
        ctx.fillStyle = '#000000';
        ctx.lineWidth = Math.max(1, Math.floor(1 * relScale * 0.5));
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        
        xCuts.forEach(x => {
           if(rng() > 0.8) { 
               if(isManualMode && !checkMask(x/canvas.width, 0.5)) return;
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); 
           }
        });
        yCuts.forEach(y => {
           if(rng() > 0.8) { 
               if(isManualMode && !checkMask(0.5, y/canvas.height)) return;
               ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); 
           }
        });

        for (let i = 0; i < 5; i++) {
            const bx = xCuts[Math.floor(rng() * (xCuts.length - 2))];
            const by = yCuts[Math.floor(rng() * (yCuts.length - 2))];
            if (isManualMode && !checkMask(bx/canvas.width, by/canvas.height)) continue;
            const bw = ((rng() > 0.5) ? (rng() * 100 + 20) : (xCuts[xCuts.indexOf(bx) + 1] - bx));
            const bh = ((rng() > 0.5) ? (rng() * 100 + 20) : (yCuts[yCuts.indexOf(by) + 1] - by));
            if (rng() > 0.3) ctx.fillRect(bx, by, bw, bh);
        }
    }

    if (showTextAnnotations) {
        ctx.textAlign = 'left';
        const maxAnnotations = Math.floor(15 * (density/100));
        let count = 0;
        const mainFont = Math.max(12, Math.floor(18 * relScale * 0.8));
        const subFont = Math.max(8, Math.floor(12 * relScale * 0.8));
        const spacing1 = Math.floor(10 * relScale * 0.8);
        const spacing2 = Math.floor(5 * relScale * 0.8);
        const spacing3 = Math.floor(8 * relScale * 0.8);
        const barWidth = Math.floor(45 * relScale * 0.8);
        const barHeight = Math.max(1, Math.floor(2 * relScale * 0.8));

        for (let j = 5; j < yCuts.length - 5; j+=2) {
            if (count >= maxAnnotations) break;
            if (rng() > 0.7) {
                const y = yCuts[j];
                const x = xCuts[Math.floor(rng() * (xCuts.length - 5)) + 2];
                if (isManualMode && !checkMask(x/canvas.width, y/canvas.height)) continue;
                
                const word = aiWords[Math.floor(rng() * aiWords.length)];
                const num = Math.floor(rng() * 50) + 1;
                
                ctx.fillStyle = textColor;
                ctx.font = `900 ${mainFont}px "Space Mono", monospace`;
                ctx.fillText(word, x, y - spacing1);
                ctx.font = `${subFont}px "Space Mono", monospace`;
                ctx.fillText(`${num}+`, x, y + spacing2);
                ctx.fillRect(x, y + spacing3, barWidth, barHeight);
                count++;
            }
        }
    }
  }, [image, rotation, seed, scale, complexity, density, stretchInt, brutalInt, stretchDirX, stretchDirY, showGridLines, showTextAnnotations, textColor, isManualMode, brushSize, aiWords]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  return (
    <div className="flex flex-col-reverse md:flex-row h-[100dvh] md:h-screen font-sans overflow-hidden bg-[#050505] text-[#e5e5e5]">
      
      {/* --- PANEL KIRI --- */}
      <div className={`w-full md:w-[340px] h-[60dvh] md:h-full shadow-2xl flex flex-col z-10 overflow-y-auto border-t md:border-t-0 md:border-r flex-shrink-0 transition-colors duration-200 bg-[#0a0a0a] border-[#222]`}>
        
        {/* Header Panel */}
        <div className={`p-6 border-b flex justify-between items-start transition-colors duration-200 bg-[#111] border-[#222]`}>
          <div>
            <h1 className={`text-xl font-bold tracking-tight text-[#10B981]`} style={{fontFamily: "'Space Mono', monospace"}}>Grid Tools Studio</h1>
            <p className={`text-xs mt-1 font-medium text-[#888]`}>Advanced Slit-Scan Distortion</p>
          </div>
        </div>

        <div className="p-6 flex-1 flex flex-col space-y-7">
          {/* Operasi Gambar */}
          <div className="space-y-4">
            <h2 className={`text-xs font-bold uppercase tracking-wider mb-2 text-[#555]`} style={{fontFamily: "'Space Mono', monospace"}}>Image Operations</h2>
            <button onClick={() => fileInputRef.current.click()} className={`w-full py-3.5 rounded-lg font-bold transition shadow-lg active:scale-95 bg-[#10B981] text-black hover:bg-[#059669] shadow-[0_0_15px_rgba(16,185,129,0.3)]`}>
              Upload Image
            </button>
            <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
            <div className="flex space-x-3">
              <button onClick={handleRotate} className={`flex-1 text-sm py-2.5 rounded-md font-medium transition bg-[#222] text-[#ccc] hover:bg-[#333] border border-[#333]`}>↻ Rotate</button>
              <button onClick={handleRandomize} className={`flex-1 text-sm py-2.5 rounded-md font-medium transition bg-[#222] text-[#ccc] hover:bg-[#333] border border-[#333]`}>🔀 Randomize</button>
            </div>
            <div className="pt-2">
                <div className={`flex justify-between text-xs font-semibold mb-2 text-[#ccc]`}>
                    <span>Image Scale (Bleed)</span>
                    <span className={`px-2 py-0.5 rounded font-mono bg-[#222] text-[#00FFFF]`}>{scale}%</span>
                </div>
                <input type="range" min="10" max="100" value={scale} onChange={(e) => setScale(Number(e.target.value))} className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#10B981] bg-[#222]`} />
            </div>
          </div>
          <hr className={`border-t border-[#222]`} />

          {/* Mode Seleksi */}
          <div className="space-y-4">
            <h2 className={`text-xs font-bold uppercase tracking-wider mb-2 text-[#555]`} style={{fontFamily: "'Space Mono', monospace"}}>Effect Spread Mode</h2>
            <div className={`flex p-1 rounded-lg bg-[#111] border border-[#222]`}>
                <button onClick={() => { setIsManualMode(false); setActiveTool('pan'); handleRandomize(); }} className={`flex-1 text-xs py-2 font-semibold rounded-md transition-all ${!isManualMode ? 'bg-[#222] text-[#10B981] shadow-sm border border-[#333]' : 'text-[#888] hover:text-[#ccc]'}`}>Auto (Random)</button>
                <button onClick={() => { setIsManualMode(true); setActiveTool('brush'); }} className={`flex-1 text-xs py-2 font-semibold rounded-md transition-all ${isManualMode ? 'bg-[#222] text-[#10B981] shadow-sm border border-[#333]' : 'text-[#888] hover:text-[#ccc]'}`}>Manual (Brush)</button>
            </div>
            {isManualMode && (
                <div className={`p-4 border rounded-lg space-y-4 bg-[#0a0a0a] border-[#00FFFF]/30`}>
                    <p className={`text-[11px] font-medium leading-relaxed text-[#00FFFF]`}>🖌️ Swipe your cursor over the image to paint the effect.</p>
                    <div>
                        <div className={`flex justify-between text-[10px] font-semibold mb-2 text-[#ccc]`}>
                            <span>Brush Size</span><span className="text-[#00FFFF] font-mono">{brushSize}</span>
                        </div>
                        <input type="range" min="10" max="150" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#00FFFF] bg-[#222]`} />
                    </div>
                    <button onClick={clearMask} className={`w-full text-[11px] py-2.5 rounded-md font-bold transition bg-[#222] border border-[#333] text-[#ccc] hover:bg-[#333]`}>🗑️ Clear Selection</button>
                </div>
            )}
          </div>
          <hr className={`border-t border-[#222]`} />

          {/* AI */}
          <div className="space-y-3">
             <div className="flex items-center justify-between mb-2">
                 <h2 className={`text-xs font-bold uppercase tracking-wider text-[#555]`} style={{fontFamily: "'Space Mono', monospace"}}>Auto Annotation</h2>
                 <div className={`flex p-1 rounded-md bg-[#111] border border-[#222]`}>
                     {['EN', 'JP', 'ID'].map(lang => (
                         <button key={lang} onClick={() => setAnnoLang(lang)} className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${annoLang === lang ? 'bg-[#222] text-[#00FFFF] shadow-sm border border-[#333]' : 'text-[#888] hover:text-[#ccc]'}`}>{lang}</button>
                     ))}
                 </div>
             </div>
             <div>
                 <input type="password" placeholder="GitHub Token (ghp_...)" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} className={`w-full text-xs p-2.5 border rounded-md focus:border-[#10B981] focus:outline-none bg-[#111] border-[#333] text-white`} />
                 <a href="https://github.com/marketplace/models" target="_blank" rel="noreferrer" className={`text-[10px] mt-1.5 inline-block font-medium hover:underline text-[#00FFFF]`}>Get GitHub API Token here</a>
             </div>
             <div className="flex items-center gap-3 pt-1">
                 <div className={`flex-1 border rounded-lg p-2.5 flex justify-between items-center shadow-sm bg-[#111] border-[#333]`}>
                     <span className={`text-sm font-semibold text-[#ccc]`}>Auto Analysis</span>
                     <span className={`text-[10px] font-bold px-2 py-1 rounded-full bg-[#222] text-[#10B981] border border-[#10B981]/50`}>GITHUB</span>
                 </div>
                 <button onClick={handleAiAnalysis} disabled={isAiAnalyzing || !image} className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition shadow-sm flex items-center justify-center ${isAiAnalyzing || !image ? 'bg-[#222] text-[#555] border border-[#333] cursor-not-allowed' : 'bg-[#10B981] text-black hover:bg-[#059669] active:scale-95 shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}>
                     {isAiAnalyzing ? 'Scanning...' : 'Scan AI'}
                 </button>
             </div>
             <p className={`text-[11px] font-medium mt-1 text-[#888]`}>Generated texts: <span className="text-[#00FFFF] font-bold">{aiWords.length} words</span> ({annoLang}).</p>
          </div>
          <hr className={`border-t border-[#222]`} />

          {/* Parameter Slitscan */}
          <div className="space-y-5">
            <h2 className={`text-xs font-bold uppercase tracking-wider mb-2 text-[#555]`} style={{fontFamily: "'Space Mono', monospace"}}>Slit-Scan Options</h2>
            <div>
                <div className={`flex justify-between text-xs font-semibold mb-2 text-[#ccc]`}><span>Cut Complexity</span><span className="text-[#10B981] font-mono">{complexity}%</span></div>
                <input type="range" min="10" max="100" value={complexity} onChange={(e) => setComplexity(Number(e.target.value))} className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#10B981] bg-[#222]`} />
            </div>
            <div>
                <div className={`flex justify-between text-xs font-semibold mb-2 text-[#ccc]`}><span>Density (Empty Gaps)</span><span className="text-[#10B981] font-mono">{density}%</span></div>
                <input type="range" min="10" max="100" value={density} onChange={(e) => setDensity(Number(e.target.value))} className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#10B981] bg-[#222]`} disabled={isManualMode} />
            </div>
            <div>
                <div className={`flex justify-between text-xs font-semibold mb-2 text-[#ccc]`}><span>Stretch Intensity (Overshoot)</span><span className="text-[#00FFFF] font-mono">{stretchInt}%</span></div>
                <input type="range" min="0" max="150" value={stretchInt} onChange={(e) => setStretchInt(Number(e.target.value))} className={`w-full h-1.5 rounded-lg cursor-pointer accent-[#00FFFF] bg-[#222]`} />
            </div>
            <div>
                <div className={`flex justify-between text-xs font-semibold mb-2 text-[#ccc]`}><span>Brutal Distortion</span><span className="text-red-500 font-mono">{brutalInt}%</span></div>
                <input type="range" min="0" max="100" value={brutalInt} onChange={(e) => setBrutalInt(Number(e.target.value))} className={`w-full h-1.5 rounded-lg cursor-pointer accent-red-500 bg-[#222]`} />
            </div>
            <div className="flex items-center justify-between pt-2">
                <span className={`text-xs font-semibold text-[#ccc]`}>Stretch Direction</span>
                <div className={`flex items-center space-x-1 text-[11px] font-mono font-bold p-1 rounded-md border bg-[#111] border-[#333]`}>
                    <button className={`px-3 py-1.5 rounded ${stretchDirX ? 'bg-[#222] text-[#00FFFF] shadow-sm border border-[#444]' : 'text-[#888]'}`} onClick={() => setStretchDirX(!stretchDirX)}>H</button>
                    <button className={`px-3 py-1.5 rounded ${stretchDirY ? 'bg-[#222] text-[#00FFFF] shadow-sm border border-[#444]' : 'text-[#888]'}`} onClick={() => setStretchDirY(!stretchDirY)}>V</button>
                </div>
            </div>
          </div>
          <hr className={`border-t border-[#222]`} />

          {/* Tampilan */}
          <div className="space-y-4">
             <h2 className={`text-xs font-bold uppercase tracking-wider mb-2 text-[#555]`} style={{fontFamily: "'Space Mono', monospace"}}>Visuals & Annotations</h2>
             <label className="flex items-center justify-between cursor-pointer">
                 <span className={`text-sm font-semibold text-[#ccc]`}>Show Grid Lines & Blocks</span>
                 <input type="checkbox" checked={showGridLines} onChange={(e) => setShowGridLines(e.target.checked)} className="w-4.5 h-4.5 accent-[#10B981]" />
             </label>
             <div className="space-y-3">
                 <label className="flex items-center justify-between cursor-pointer">
                     <span className={`text-sm font-semibold text-[#ccc]`}>Show Annotation Text</span>
                     <input type="checkbox" checked={showTextAnnotations} onChange={(e) => setShowTextAnnotations(e.target.checked)} className="w-4.5 h-4.5 accent-[#00FFFF]" />
                 </label>
                 {showTextAnnotations && (
                     <div className={`flex items-center justify-between pl-3 border-l-2 ml-1 border-[#333]`}>
                         <span className={`text-xs font-medium text-[#888]`}>Text Color</span>
                         <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-7 h-7 p-0 border-0 rounded cursor-pointer bg-transparent" />
                     </div>
                 )}
             </div>
          </div>
        </div>

        <div className={`p-6 border-t transition-colors duration-200 bg-[#111] border-[#222]`}>
           <div className="flex space-x-3">
              <button onClick={() => handleExport('png')} className={`flex-1 py-3 rounded-lg font-bold text-sm transition active:scale-95 bg-[#00FFFF] text-black hover:bg-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.3)]`}>Export PNG</button>
              <button onClick={() => handleExport('jpg')} className={`flex-1 border py-3 rounded-lg font-bold text-sm transition active:scale-95 border-[#333] bg-[#222] text-[#ccc] hover:bg-[#333]`}>Export JPG</button>
           </div>
        </div>
      </div>

      {/* --- PANEL KANAN (PRO WORKSPACE) --- */}
      <div 
        className={`flex-1 relative overflow-hidden touch-none transition-colors duration-200 bg-[#050505]`}
        onPointerMove={handleWorkspacePointerMove}
        onPointerUp={handleWorkspacePointerUp}
        onPointerLeave={handleWorkspacePointerUp}
      >
         
         <div className={`absolute top-0 left-0 w-[24px] h-[24px] border-b border-r z-50 transition-colors bg-[#0a0a0a] border-[#222]`}></div>

         <div 
            className={`absolute top-0 left-[24px] right-0 h-[24px] border-b z-40 overflow-hidden transition-colors bg-[#0a0a0a] border-[#222]`}
            onPointerDown={(e) => startGuideFromRuler(e, 'h')}
         >
            <Ruler type="h" pan={pan} zoom={viewScale} length={viewportSize.w} />
         </div>

         <div 
            className={`absolute top-[24px] left-0 bottom-0 w-[24px] border-r z-40 overflow-hidden transition-colors bg-[#0a0a0a] border-[#222]`}
            onPointerDown={(e) => startGuideFromRuler(e, 'v')}
         >
             <Ruler type="v" pan={pan} zoom={viewScale} length={viewportSize.h} />
         </div>

         <div 
            className="absolute top-[24px] left-[24px] right-0 bottom-0 overflow-hidden"
            ref={viewportRef}
            onPointerDown={handleWorkspacePointerDown}
            onWheel={(e) => {
                e.preventDefault();
                if (e.deltaY < 0) setViewScale(v => Math.min(v + 0.1, 5));
                else setViewScale(v => Math.max(v - 0.1, 0.1));
            }}
         >
            <div 
               style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${viewScale})`, transformOrigin: 'center' }}
               className={`w-full h-full flex items-center justify-center transition-transform duration-75
                           ${activeTool === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}
            >
               <canvas ref={canvasRef} className="shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-[#050505] object-contain" />
            </div>

            {guides.map(g => (
               <div 
                  key={g.id}
                  style={{ [g.type === 'h' ? 'top' : 'left']: (g.type === 'h' ? viewportSize.h/2 + pan.y + g.pos * viewScale : viewportSize.w/2 + pan.x + g.pos * viewScale) + 'px' }}
                  className={`absolute z-30 flex items-center justify-center
                             ${g.type === 'h' ? 'left-0 right-0 h-[7px] -mt-[3px] cursor-ns-resize' : 'top-0 bottom-0 w-[7px] -ml-[3px] cursor-ew-resize'}`}
                  onPointerDown={(e) => { e.stopPropagation(); setDraggingGuide({id: g.id, type: g.type}); }}
               >
                  <div className={`bg-[#00FFFF] shadow-[0_0_2px_#00FFFF] ${g.type === 'h' ? 'w-full h-[1px]' : 'h-full w-[1px]'}`}></div>
               </div>
            ))}
         </div>

         {/* --- FLOATING TOOLBAR KIRI --- */}
         <div className="absolute top-[44px] left-[44px] bg-[#0a0a0a]/90 backdrop-blur-md border border-[#222] rounded-md shadow-2xl flex flex-col z-50 overflow-hidden">
            <button 
                className={`p-3 transition flex items-center justify-center ${activeTool==='pan'?'bg-[#10B981] text-black shadow-[0_0_10px_rgba(16,185,129,0.5)]':'text-[#888] hover:text-white hover:bg-[#222]'}`}
                onClick={() => setActiveTool('pan')} title="Hand Tool (Pan Canvas)"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="19 9 22 12 19 15"/><polyline points="9 19 12 22 15 19"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
            </button>
            <button 
                className={`p-3 transition flex items-center justify-center ${activeTool==='brush'?'bg-[#10B981] text-black shadow-[0_0_10px_rgba(16,185,129,0.5)]':'text-[#888] hover:text-white hover:bg-[#222]'}`}
                onClick={() => { setActiveTool('brush'); setIsManualMode(true); }} title="Brush Tool (Paint Effect Area)"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.35 2.22 1.45 3.02 1.45 2.67 0 4.81-2.16 4.81-4.83 0-1.66-1.34-3.02-3.01-3.02z"/></svg>
            </button>
            <div className="h-[1px] bg-[#222] w-full"></div>
            <button 
                className="p-3 transition flex items-center justify-center text-red-500 hover:bg-red-500/20 hover:text-red-400"
                onClick={() => setGuides([])} title="Clear All Guides"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
         </div>

         {/* --- FLOATING ZOOM PANEL KANAN BAWAH --- */}
         <div className="absolute bottom-6 right-6 bg-[#0a0a0a]/90 backdrop-blur-md text-[#ccc] text-xs rounded shadow-2xl flex items-center border border-[#222] overflow-hidden z-50">
            <button className="px-4 py-3 hover:bg-[#222] transition font-bold" onClick={() => setViewScale(v => Math.max(0.1, v - 0.1))}>—</button>
            <span className="px-3 font-mono border-x border-[#222] min-w-[65px] text-center text-[#00FFFF]">{Math.round(viewScale * 100)}%</span>
            <button className="px-4 py-3 hover:bg-[#222] transition font-bold" onClick={() => setViewScale(v => Math.min(5, v + 0.1))}>+</button>
            <button className="px-4 py-3 hover:bg-[#222] transition text-[#10B981] font-semibold" onClick={() => { setViewScale(1); setPan({x:0, y:0}); }}>Reset</button>
         </div>

      </div>
    </div>
  );
}