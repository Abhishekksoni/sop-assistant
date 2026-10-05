'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  ArrowUp, 
  Bot, 
  BookOpen, 
  FileText, 
  Copy, 
  Check, 
  Filter, 
  RefreshCw, 
  Info, 
  Layers, 
  Eye, 
  Menu, 
  Sun, 
  Moon, 
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { Message, SourceCitation, DocumentItem, User } from '@/types';
import { PdfHighlightViewerModal } from './PdfHighlightViewerModal';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  availableDocuments: DocumentItem[];
  selectedDepartment: string;
  setSelectedDepartment: (dept: string) => void;
  selectedDocId: string;
  setSelectedDocId: (docId: string) => void;
  currentUser: User | null;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenMobileMenu?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isLoading,
  onSendMessage,
  availableDocuments,
  selectedDepartment,
  setSelectedDepartment,
  selectedDocId,
  setSelectedDocId,
  currentUser,
  isDark,
  onToggleTheme,
  onOpenMobileMenu,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAdmin = currentUser?.role === 'master_admin' || currentUser?.role === 'admin' || currentUser?.is_master_admin;

  // Helper to scroll chat smoothly to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  };

  // Scroll event listener on chat container
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isFarFromBottom);
  };

  // Auto-scroll when messages update or loading starts/stops
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom('smooth');
    }, 60);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Helper to render masked highlight text in citation cards
  const renderInlineHighlight = (text: string, phrase?: string) => {
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
                className="bg-amber-400/40 text-amber-300 dark:text-amber-200 border-b border-amber-500 font-medium px-1 py-0.5 rounded text-[11px]"
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

  const handleOpenViewer = (citation: SourceCitation) => {
    setSelectedCitation(citation);
    setIsViewerOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Extract unique departments from available documents
  const departments = Array.from(
    new Set(availableDocuments.map((d) => d.department).filter(Boolean))
  ) as string[];

  const promptSuggestions = [
    "What is the daily calibration procedure for analytical balances?",
    "What are the tolerance limits and verification steps?",
    "What corrective actions should be taken if calibration fails?",
    "Summarize the cleaning and maintenance requirements.",
  ];

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden relative transition-colors duration-200 ${
        isDark ? 'bg-[#212121] text-zinc-100' : 'bg-white text-zinc-900'
      }`}
    >
      {/* Top Header Bar (ChatGPT Style with filters) */}
      <div
        className={`h-14 border-b px-4 sm:px-6 flex items-center justify-between z-10 shrink-0 transition-colors ${
          isDark ? 'bg-[#212121]/90 border-[#2f2f2f]' : 'bg-white/90 border-zinc-200'
        } backdrop-blur-md`}
      >
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle Button */}
          <button
            onClick={onOpenMobileMenu}
            className={`p-2 rounded-lg md:hidden transition-colors ${
              isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Department Filter Dropdown */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className={`rounded-lg px-2 py-1 border text-xs focus:outline-none transition-colors ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-200 focus:border-emerald-500'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-emerald-500'
              }`}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Tools (Theme Toggle & Scope info) */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Verified SOP Citations Active</span>
          </div>

          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-xl border transition-colors ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-amber-300'
                : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900'
            }`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Messages Scroll Area */}
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 md:p-8 space-y-6 scrollbar-thin scroll-smooth pb-12"
      >
        {messages.length === 0 ? (
          /* Empty State: ChatGPT Prompt Suggestions */
          <div className="max-w-2xl mx-auto my-auto py-8 sm:py-16 text-center flex flex-col items-center animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-950/30 mb-5 text-white">
              <BookOpen className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">
              What can I help you find in SOPs?
            </h2>
            <p className={`text-xs sm:text-sm max-w-md mb-8 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Ask procedural, compliance, or calibration questions directly grounded in your verified SOP documentation with exact page citations.
            </p>

            {/* Suggestions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {promptSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(suggestion)}
                  className={`p-3.5 rounded-2xl border text-xs transition-all text-left flex items-start gap-2.5 group cursor-pointer ${
                    isDark
                      ? 'bg-[#2a2a2a]/80 hover:bg-[#2f2f2f] border-[#383838] text-zinc-200'
                      : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800 shadow-xs'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <span className="leading-relaxed font-medium">{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat Message Stream */
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3.5 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Assistant Avatar */}
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 shadow-md text-white font-bold text-xs mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`relative max-w-[88%] rounded-2xl p-4 sm:p-5 shadow-xs text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-xs'
                      : isDark
                      ? 'bg-[#2f2f2f] border border-[#3a3a3a] text-zinc-100 rounded-tl-xs'
                      : 'bg-[#f4f4f4] border border-zinc-200 text-zinc-900 rounded-tl-xs'
                  }`}
                >
                  {/* Markdown Content */}
                  <div
                    className={`prose prose-sm max-w-none break-words ${
                      isDark ? 'prose-invert text-zinc-100' : 'text-zinc-900'
                    }`}
                  >
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>

                  {/* Verified Sources Citations Accordion */}
                  {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                    <div
                      className={`mt-4 pt-3.5 border-t ${
                        isDark ? 'border-zinc-700/60' : 'border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 text-xs font-semibold text-emerald-500 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Verified SOP Sources & Citations ({message.sources.length})</span>
                        </div>
                        <span className={`text-[10px] font-normal ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Click to inspect masked PDF
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {message.sources.map((src, i) => (
                          <div
                            key={i}
                            className={`border rounded-xl p-3 text-xs flex flex-col justify-between transition-all group ${
                              isDark
                                ? 'bg-[#212121]/90 border-zinc-700/80 hover:border-emerald-500/50'
                                : 'bg-white border-zinc-200 hover:border-emerald-500/50 shadow-xs'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                <span
                                  className="font-semibold truncate group-hover:text-emerald-500 transition-colors"
                                  title={src.document_name || src.filename}
                                >
                                  {src.document_name || src.filename || `Document ${i + 1}`}
                                </span>
                                <span className="bg-emerald-500/10 text-emerald-500 font-mono text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0 font-bold">
                                  Page {src.page_number || 1}
                                </span>
                              </div>

                              {/* Masked Snippet */}
                              <div
                                className={`text-[11px] line-clamp-3 mb-2.5 leading-relaxed p-2 rounded-lg border font-serif ${
                                  isDark
                                    ? 'bg-[#181818] border-zinc-800 text-zinc-300'
                                    : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                                }`}
                              >
                                {renderInlineHighlight(src.content, src.highlight_phrase || src.search_query)}
                              </div>
                            </div>

                            <div
                              className={`flex items-center justify-between gap-2 pt-1 border-t ${
                                isDark ? 'border-zinc-800' : 'border-zinc-100'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleOpenViewer(src)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500 hover:text-amber-400 hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect Masked PDF</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Copy Button */}
                  {message.role === 'assistant' && (
                    <div className="mt-2.5 flex items-center justify-end">
                      <button
                        onClick={() => copyToClipboard(message.content, message.id)}
                        className={`text-[11px] flex items-center gap-1 p-1 rounded-md transition-colors ${
                          isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                        title="Copy answer"
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-zinc-700 text-white border border-zinc-600 flex items-center justify-center shrink-0 font-bold text-xs uppercase mt-1">
                    {currentUser?.email ? currentUser.email.substring(0, 2) : 'U'}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex gap-3.5 items-start">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 animate-pulse mt-1">
                  <Bot className="w-4 h-4" />
                </div>
                <div
                  className={`border rounded-2xl rounded-tl-xs p-4 text-sm flex items-center gap-2.5 ${
                    isDark ? 'bg-[#2f2f2f] border-[#3a3a3a] text-zinc-200' : 'bg-zinc-100 border-zinc-200 text-zinc-800'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  <span>Searching SOP vectors and synthesizing verified answer...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Bottom Input Capsule (ChatGPT Style) */}
      <div
        className={`p-4 sm:p-6 bg-gradient-to-t pt-4 relative ${
          isDark
            ? 'from-[#171717] via-[#212121] to-transparent'
            : 'from-white via-[#fcfcfc] to-transparent'
        }`}
      >
        <div className="max-w-3xl mx-auto relative">
          {/* Scroll to bottom floating shortcut */}
          {showScrollBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className={`absolute right-2 -top-12 z-20 p-2 rounded-full shadow-lg border transition-all animate-in fade-in zoom-in-90 cursor-pointer ${
                isDark
                  ? 'bg-[#2f2f2f] hover:bg-[#383838] border-zinc-700 text-zinc-200 shadow-black/50'
                  : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700 shadow-zinc-300/60'
              }`}
              title="Scroll to latest messages"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          <form
            onSubmit={handleSubmit}
            className={`relative rounded-3xl border shadow-xl transition-all flex items-end p-2.5 ${
              isDark
                ? 'bg-[#2f2f2f] border-[#3f3f3f] focus-within:border-emerald-500/80 shadow-black/40'
                : 'bg-white border-zinc-300 focus-within:border-emerald-500/80 shadow-zinc-200/80'
            }`}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about Standard Operating Procedures (SOPs)..."
              disabled={isLoading}
              className={`flex-1 bg-transparent text-sm resize-none px-3.5 py-2 focus:outline-none max-h-40 min-h-[40px] overflow-y-auto leading-relaxed scrollbar-thin ${
                isDark ? 'text-zinc-100 placeholder-zinc-500' : 'text-zinc-900 placeholder-zinc-400'
              }`}
            />

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                input.trim() && !isLoading
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold shadow-md cursor-pointer'
                  : isDark
                  ? 'bg-zinc-700/50 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
              }`}
            >
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
            </button>
          </form>

          <p
            className={`text-[11px] text-center mt-2.5 flex items-center justify-center gap-1.5 ${
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Answers are grounded directly in your active SOP documents and indexed with Gemini 3.8 Flash.</span>
          </p>
        </div>
      </div>

      {/* PDF Highlight & Mask Inspector Modal */}
      <PdfHighlightViewerModal
        isOpen={isViewerOpen}
        citation={selectedCitation}
        isAdmin={isAdmin}
        onClose={() => {
          setIsViewerOpen(false);
          setSelectedCitation(null);
        }}
      />
    </div>
  );
};
