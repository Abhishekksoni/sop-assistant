'use client';

import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  FileText, 
  Eye, 
  Layers, 
  ShieldCheck, 
  Target
} from 'lucide-react';
import { SourceCitation } from '@/types';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface PdfHighlightViewerModalProps {
  citation: SourceCitation | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export const PdfHighlightViewerModal: React.FC<PdfHighlightViewerModalProps> = ({
  citation,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(citation?.page_number || 1);
  const [activeTab, setActiveTab] = useState<'canvas' | 'text'>('canvas');
  const [showInspector, setShowInspector] = useState(true);

  // Update current page when citation changes
  React.useEffect(() => {
    if (citation?.page_number) {
      setCurrentPage(citation.page_number);
    }
  }, [citation]);

  // DRM Keyboard Protection: Disable Print and Save shortcuts
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  if (!isOpen || !citation) return null;

  const documentName = citation.document_name || citation.filename || 'SOP Document';
  const fileUrl = citation.file_url || (citation.filename ? `/api/v1/documents/files/${encodeURIComponent(citation.filename)}` : '');
  const highlightPhrase = citation.highlight_phrase || citation.search_query || '';

  const handleCopyQuote = () => {
    navigator.clipboard.writeText(citation.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to render text with masked highlight tokens
  const renderHighlightedContent = (text: string, phrase: string) => {
    if (!phrase || phrase.trim().length === 0) {
      return <span>{text}</span>;
    }

    const searchWords = phrase
      .split(/\s+/)
      .map((w) => w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter((w) => w.length > 2);

    if (searchWords.length === 0) {
      return <span>{text}</span>;
    }

    const regex = new RegExp(`(${searchWords.join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) => {
          const isMatch = searchWords.some((sw) => new RegExp(`^${sw}$`, 'i').test(part));
          if (isMatch) {
            return (
              <mark
                key={index}
                className="bg-amber-400/35 text-amber-200 border-b-2 border-amber-400 font-medium px-1 py-0.5 rounded shadow-sm shadow-amber-500/10"
              >
                {part}
              </mark>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div className="bg-[#181818] border border-zinc-750 w-full max-w-7xl h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        
        {/* Top Header Bar */}
        <div className="px-5 py-3 bg-[#141414] border-b border-zinc-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate max-w-md" title={documentName}>
                  {documentName}
                </h3>
                {citation.version && (
                  <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700 font-mono">
                    v{citation.version}
                  </span>
                )}
                {citation.department && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                    {citation.department}
                  </span>
                )}
                <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium flex items-center gap-1">
                  <Target className="w-2.5 h-2.5" />
                  <span>Target Page {currentPage}</span>
                </span>
              </div>
            
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                showInspector 
                  ? 'bg-zinc-800 border-zinc-600 text-white' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title="Toggle Highlight Inspector Panel"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Context Panel</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content (Split Layout) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Panel: Masked Highlight Inspector */}
          {showInspector && (
            <div className="w-full md:w-96 lg:w-[400px] bg-[#1a1a1a] border-b md:border-b-0 md:border-r border-zinc-800 p-4 overflow-y-auto flex flex-col justify-between shrink-0 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Verified Chunk Highlight
                    </h4>
                  </div>
                  {citation.similarity !== undefined && (
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                      {Math.round(citation.similarity * 100)}% Match
                    </span>
                  )}
                </div>

                {/* Mask Preview Card */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                  <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Dynamic Mask Overlay Active
                    </span>
                    <span className="font-mono text-[11px]">Page {currentPage}</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans bg-black/40 p-2.5 rounded-lg border border-amber-500/15">
                    {renderHighlightedContent(citation.content, highlightPhrase)}
                  </p>
                </div>

                {/* Metadata & Audit Trail */}
                <div className="space-y-2 text-xs text-zinc-400">
                  <h5 className="font-semibold text-zinc-200">SOP Metadata</h5>
                  <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-zinc-800/80">
                      <span className="text-zinc-500">Document Name:</span>
                      <span className="text-zinc-200 font-medium truncate max-w-[200px]" title={documentName}>{documentName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/80">
                      <span className="text-zinc-500">File Reference:</span>
                      <span className="text-zinc-200 font-mono truncate max-w-[200px]">{citation.filename || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/80">
                      <span className="text-zinc-500">Department:</span>
                      <span className="text-zinc-200">{citation.department || 'General'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/80">
                      <span className="text-zinc-500">Version:</span>
                      <span className="text-zinc-200 font-mono">v{citation.version || '1.0'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-500">Verification Status:</span>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Compliance Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action: Copy Extracted Text */}
              <div className="pt-2 border-t border-zinc-800/80">
                <button
                  onClick={handleCopyQuote}
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-medium transition-colors flex items-center justify-center gap-2 border border-zinc-700 shadow-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Citation Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Copy Exact SOP Excerpt</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Right Area: PDF Canvas Viewer & Text Mode */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#111111]">
            
            {/* View Mode Switcher */}
            <div className="px-4 py-2 bg-[#141414] border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                <button
                  onClick={() => setActiveTab('canvas')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === 'canvas'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Dynamic Mask Viewer</span>
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === 'text'
                      ? 'bg-zinc-700 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Text Mode</span>
                </button>
              </div>

              <div className="text-[11px] text-zinc-400 hidden sm:block">
                <span>Highlighting: </span>
                <span className="text-amber-300 font-mono font-medium">Only Matched Chunk</span>
              </div>
            </div>

            {/* Main Canvas View with PDF.js and Precision Highlighting */}
            <div className="flex-1 overflow-hidden relative">
              {activeTab === 'canvas' ? (
                <PdfCanvasViewer
                  fileUrl={fileUrl}
                  filename={citation.filename}
                  targetPage={currentPage}
                  matchedChunkText={citation.content}
                  onPageChange={(p) => setCurrentPage(p)}
                />
              ) : (
                /* Text View Mode */
                <div className="w-full h-full p-6 md:p-10 overflow-y-auto bg-zinc-900 text-zinc-100 flex justify-center">
                  <div className="max-w-2xl w-full bg-zinc-950 p-6 sm:p-8 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white">{documentName}</h4>
                        <p className="text-xs text-amber-400">Page {currentPage} Segment</p>
                      </div>
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded">
                        Text Extraction Mode
                      </span>
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-serif text-zinc-200">
                      {renderHighlightedContent(citation.content, highlightPhrase)}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
