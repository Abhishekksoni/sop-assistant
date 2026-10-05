'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  Target,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Maximize2,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

interface PageHighlightData {
  pageNumber: number;
  rects: HighlightRect[];
}

interface PdfCanvasViewerProps {
  fileUrl: string;
  filename?: string;
  targetPage: number;
  matchedChunkText: string;
  onPageChange?: (page: number) => void;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  fileUrl,
  filename,
  targetPage = 1,
  matchedChunkText,
  onPageChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.15);
  const [loading, setLoading] = useState<boolean>(true);
  const [renderedPages, setRenderedPages] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pageHighlights, setPageHighlights] = useState<{ [key: number]: HighlightRect[] }>({});
  const [isMaskActive, setIsMaskActive] = useState<boolean>(true);
  const [activeVisiblePage, setActiveVisiblePage] = useState<number>(targetPage);

  // Load PDF.js script dynamically
  const ensurePdfJsLoaded = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('PDF.js library failed to initialize.'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js from CDN.'));
      document.head.appendChild(script);
    });
  };

  // 1. Fetch & Initialize PDF Document
  useEffect(() => {
    let isCancelled = false;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      setRenderedPages([]);

      try {
        const pdfjs = await ensurePdfJsLoaded();

        let resolvedUrl = fileUrl;
        if (!resolvedUrl && filename) {
          resolvedUrl = `/api/v1/documents/files/${encodeURIComponent(filename)}`;
        }

        const loadingTask = pdfjs.getDocument({
          url: resolvedUrl,
          withCredentials: false,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('PDF.js load error:', err);
        if (filename && fileUrl !== `/api/v1/documents/files/${encodeURIComponent(filename)}`) {
          try {
            const pdfjs = await ensurePdfJsLoaded();
            const fallbackUrl = `/api/v1/documents/files/${encodeURIComponent(filename)}`;
            const fallbackTask = pdfjs.getDocument({
              url: fallbackUrl,
              cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
              cMapPacked: true,
            });
            const fallbackDoc = await fallbackTask.promise;
            if (!isCancelled) {
              setPdfDoc(fallbackDoc);
              setTotalPages(fallbackDoc.numPages);
              setLoading(false);
              return;
            }
          } catch (fallbackErr: any) {
            if (!isCancelled) {
              setError(fallbackErr.message || 'Failed to load PDF document.');
              setLoading(false);
            }
            return;
          }
        }

        if (!isCancelled) {
          setError(err.message || 'Failed to render PDF document.');
          setLoading(false);
        }
      }
    };

    if (fileUrl || filename) {
      loadDocument();
    }

    return () => {
      isCancelled = true;
    };
  }, [fileUrl, filename]);

  // 2. Compute Precision Text Bounding Boxes for ONLY the Matched Chunk on a page
  const computeChunkHighlightsForPage = (textContent: any, viewport: any): HighlightRect[] => {
    if (!matchedChunkText || !textContent || !textContent.items) {
      return [];
    }

    const cleanChunk = matchedChunkText
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    if (cleanChunk.length === 0) {
      return [];
    }

    const chunkWindows: string[] = [];
    for (let i = 0; i < cleanChunk.length; i += 2) {
      const slice = cleanChunk.slice(i, i + 4).join(' ');
      if (slice.length > 4) chunkWindows.push(slice);
    }

    const rects: HighlightRect[] = [];

    textContent.items.forEach((item: any) => {
      if (!item.str || item.str.trim().length === 0) return;

      const itemClean = item.str
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .trim();

      if (itemClean.length < 2) return;

      const itemWords = itemClean.split(/\s+/).filter((w: string) => w.length > 1);
      const matchesChunkWord = itemWords.some((w: string) => cleanChunk.includes(w));
      const matchesWindow = chunkWindows.some((win) => itemClean.includes(win) || win.includes(itemClean));

      if (matchesChunkWord || matchesWindow) {
        const tx = item.transform;
        const x = tx[4];
        const y = tx[5];
        const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
        const fontWidth = item.width || Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * item.str.length * 0.6;

        const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
          x,
          y - fontHeight * 0.2,
          x + fontWidth,
          y + fontHeight * 0.9,
        ]);

        const rectX = Math.min(vx1, vx2);
        const rectY = Math.min(vy1, vy2);
        const rectW = Math.max(Math.abs(vx2 - vx1), 10);
        const rectH = Math.max(Math.abs(vy2 - vy1), 12);

        rects.push({
          x: rectX,
          y: rectY,
          width: rectW,
          height: rectH,
          text: item.str,
        });
      }
    });

    return rects;
  };

  // 3. Render ALL pages in sequence
  const renderAllPages = useCallback(async () => {
    if (!pdfDoc) return;

    const highlightsMap: { [key: number]: HighlightRect[] } = {};
    const rendered: number[] = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      try {
        const canvas = canvasRefs.current[pageNum];
        if (!canvas) continue;

        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const ctx = canvas.getContext('2d');

        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise;
        }

        // Only search and highlight on target page (or where chunk text is present)
        if (pageNum === targetPage || !targetPage) {
          const textContent = await page.getTextContent();
          const pageRects = computeChunkHighlightsForPage(textContent, viewport);
          highlightsMap[pageNum] = pageRects;
        } else {
          highlightsMap[pageNum] = [];
        }

        rendered.push(pageNum);
      } catch (err: any) {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    }

    setPageHighlights(highlightsMap);
    setRenderedPages(rendered);

    // Auto-scroll to target page / highlighted chunk
    setTimeout(() => {
      const targetEl = pageRefs.current[targetPage] || document.getElementById('target-highlighted-chunk');
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);
  }, [pdfDoc, scale, targetPage, matchedChunkText]);

  useEffect(() => {
    if (pdfDoc && totalPages > 0) {
      renderAllPages();
    }
  }, [pdfDoc, totalPages, scale, renderAllPages]);

  const scrollToPage = (pageNum: number) => {
    const el = pageRefs.current[pageNum];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveVisiblePage(pageNum);
      onPageChange?.(pageNum);
    }
  };

  const scrollToHighlightedChunk = () => {
    const el = pageRefs.current[targetPage] || document.getElementById('target-highlighted-chunk');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveVisiblePage(targetPage);
    }
  };

  const totalHighlightCount = Object.values(pageHighlights).reduce((acc, curr) => acc + curr.length, 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#141414] overflow-hidden text-zinc-200 select-none">
      
      {/* Top Controls Toolbar */}
      <div className="h-12 bg-[#1b1b1b] border-b border-zinc-800 px-4 flex items-center justify-between text-xs shrink-0 z-20 shadow-md">
        
        {/* Left: Document Info & Jump to Target */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-zinc-300">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Whole PDF Document:</span>
            <span className="font-bold text-white">{totalPages} Pages</span>
          </div>

          <div className="h-4 w-px bg-zinc-700 hidden sm:block" />

          {targetPage && (
            <button
              onClick={scrollToHighlightedChunk}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Jump directly to the highlighted chunk"
            >
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span>Jump to Highlighted Chunk (Page {targetPage})</span>
            </button>
          )}
        </div>

        {/* Center: Mask Status Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMaskActive(!isMaskActive)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              isMaskActive
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle Highlight Mask Overlay"
          >
            {isMaskActive ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{isMaskActive ? `Chunk Mask Active (${totalHighlightCount} tokens)` : 'Mask Hidden'}</span>
          </button>
        </div>

        {/* Right: Zoom Controls */}
        <div className="flex items-center gap-1 bg-zinc-850 border border-zinc-750 rounded-lg p-0.5">
          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] w-12 text-center text-zinc-300">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.2, s + 0.15))}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Main Continuous Document Canvas View */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center bg-[#101010] relative scrollbar-thin scrollbar-thumb-zinc-700 space-y-8"
      >
        {loading && (
          <div className="my-auto py-16 flex flex-col items-center gap-3 text-zinc-400">
            <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
            <p className="text-xs font-medium">Loading whole PDF document and applying chunk highlight mask...</p>
          </div>
        )}

        {error && (
          <div className="my-auto max-w-md p-5 bg-red-950/40 border border-red-500/30 rounded-2xl text-center text-red-300 text-xs shadow-xl">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-400" />
            <p className="font-semibold mb-1">Unable to render PDF stream</p>
            <p className="text-[11px] text-red-400/80 mb-3">{error}</p>
          </div>
        )}

        {/* Continuous Stream of All PDF Pages */}
        {!loading && !error && pdfDoc && (
          Array.from({ length: totalPages }, (_, index) => {
            const pageNum = index + 1;
            const isTargetPage = pageNum === targetPage;
            const highlights = pageHighlights[pageNum] || [];

            return (
              <div
                key={pageNum}
                ref={(el) => {
                  pageRefs.current[pageNum] = el;
                }}
                id={`pdf-page-${pageNum}`}
                className={`relative flex flex-col items-center transition-all ${
                  isTargetPage ? 'ring-2 ring-amber-500/50 rounded-xl p-1 bg-amber-500/5' : ''
                }`}
              >
                {/* Page Number Badge & Status Header */}
                <div className="w-full flex items-center justify-between pb-1.5 px-2 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 text-zinc-300">
                      Page {pageNum} of {totalPages}
                    </span>
                    {isTargetPage && (
                      <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1 animate-pulse">
                        <Target className="w-3 h-3" />
                        <span>Referenced Citation Page</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => scrollToPage(pageNum)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                  >
                    Jump to Top
                  </button>
                </div>

                {/* Canvas Page Container */}
                <div className="relative shadow-2xl rounded-lg overflow-hidden border border-zinc-750 bg-white">
                  <canvas
                    ref={(el) => {
                      canvasRefs.current[pageNum] = el;
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                    className="block pointer-events-auto select-none"
                    style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                  />

                  {/* Highlight Mask Layer (Only on Target Page with Matching Chunk) */}
                  {isMaskActive && highlights.length > 0 && (
                    <div
                      id={isTargetPage ? 'target-highlighted-chunk' : undefined}
                      className="absolute inset-0 pointer-events-none"
                      style={{ zIndex: 10 }}
                    >
                      {highlights.map((rect, idx) => (
                        <div
                          key={idx}
                          className="chunk-highlight-box absolute rounded-sm transition-all animate-pulse"
                          style={{
                            left: `${rect.x - 2}px`,
                            top: `${rect.y - 1}px`,
                            width: `${rect.width + 4}px`,
                            height: `${rect.height + 2}px`,
                            backgroundColor: 'rgba(245, 158, 11, 0.45)', // Luminous amber highlight mask
                            border: '1.5px solid rgba(217, 119, 6, 0.95)',
                            boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
                          }}
                          title={rect.text}
                        >
                          {idx === 0 && (
                            <div className="absolute -top-7 left-0 bg-amber-500 text-zinc-950 font-bold text-[10px] px-2 py-0.5 rounded shadow-lg flex items-center gap-1 whitespace-nowrap">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Matched SOP Chunk</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

      </div>

    </div>
  );
};
