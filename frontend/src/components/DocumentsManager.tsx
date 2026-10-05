'use client';

import React, { useState } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  Layers, 
  Search, 
  Building2, 
  Eye, 
  Menu, 
  Sun, 
  Moon 
} from 'lucide-react';
import { DocumentItem, User, SourceCitation } from '@/types';
import { api } from '@/lib/api';
import { PdfHighlightViewerModal } from './PdfHighlightViewerModal';

interface DocumentsManagerProps {
  documents: DocumentItem[];
  currentUser: User | null;
  onRefresh: () => void;
  onOpenMobileMenu?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const DocumentsManager: React.FC<DocumentsManagerProps> = ({
  documents,
  currentUser,
  onRefresh,
  onOpenMobileMenu,
  isDark = true,
  onToggleTheme,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [docVersion, setDocVersion] = useState('1.0');
  const [docDepartment, setDocDepartment] = useState('');
  const [docStatus, setDocStatus] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewCitation, setPreviewCitation] = useState<SourceCitation | null>(null);

  const isAdmin = currentUser?.role === 'master_admin' || currentUser?.role === 'admin';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!docName) {
        setDocName(file.name.replace(/\.pdf$/i, ''));
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({ type: 'error', message: 'Please select a .pdf file.' });
      return;
    }

    setIsUploading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (docName) formData.append('name', docName);
    formData.append('version', docVersion || '1.0');
    if (docDepartment) formData.append('department', docDepartment);
    formData.append('document_status', docStatus);

    try {
      const res = await api.uploadPdf(formData);
      setFeedback({
        type: 'success',
        message: `Successfully uploaded "${res.name}" (${res.total_pages} pages, ${res.total_chunks} chunks) to Supabase Storage & Vector DB!`,
      });
      setSelectedFile(null);
      setDocName('');
      setDocDepartment('');
      onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to upload and embed PDF.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string, docName: string) => {
    if (!confirm(`Are you sure you want to delete "${docName}" and all its vector embeddings?`)) {
      return;
    }

    setDeletingId(docId);
    try {
      await api.deleteDocument(docId);
      setFeedback({ type: 'success', message: `Deleted document "${docName}".` });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete document.' });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = filterDepartment ? doc.department === filterDepartment : true;
    return matchesSearch && matchesDept;
  });

  const departments = Array.from(new Set(documents.map((d) => d.department).filter(Boolean))) as string[];

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 scrollbar-thin transition-colors duration-200 ${
        isDark ? 'bg-[#212121] text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      }`}
    >
      {/* Header */}
      <div
        className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-5 transition-colors ${
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        }`}
      >
        <div className="flex items-start gap-3">
          {onOpenMobileMenu && (
            <button
              onClick={onOpenMobileMenu}
              className={`p-2 -ml-1 mt-0.5 rounded-lg md:hidden transition-colors shrink-0 ${
                isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-200'
              }`}
              title="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-emerald-500" />
              <span>SOP Documents & Vector Catalog</span>
            </h1>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Browse indexed standard operating procedures and upload new PDF guidelines with automatic Gemini embeddings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-lg border transition-colors shadow-xs ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
              }`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
            </button>
          )}

          <button
            onClick={onRefresh}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shadow-xs ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                : 'bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
            feedback.type === 'success'
              ? isDark
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isDark
              ? 'bg-red-950/40 border-red-500/30 text-red-300'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Admin Upload Section */}
      {isAdmin && (
        <div
          className={`border rounded-2xl p-6 transition-colors shadow-xs ${
            isDark ? 'bg-[#242424] border-zinc-700' : 'bg-white border-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold">Upload New SOP Document</h2>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              Admin Action
            </span>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            {/* File Picker */}
            <div
              className={`border-2 border-dashed hover:border-emerald-500/70 rounded-xl p-6 text-center cursor-pointer transition-colors relative ${
                isDark
                  ? 'border-zinc-700 bg-zinc-900/40 text-zinc-300'
                  : 'border-zinc-300 bg-zinc-50/80 text-zinc-700'
              }`}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
              {selectedFile ? (
                <div>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{selectedFile.name}</p>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">Click to browse or drag and drop a PDF file</p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Will be uploaded to Supabase Storage &apos;sop-bucket&apos; and vectorized with Gemini
                  </p>
                </div>
              )}
            </div>

            {/* Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. SOP-QC-014 Balances"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className={`w-full text-xs rounded-lg px-3 py-2 border focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${
                    isDark
                      ? 'bg-zinc-900 text-zinc-200 border-zinc-700 placeholder-zinc-500'
                      : 'bg-white text-zinc-900 border-zinc-300 placeholder-zinc-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                  Version
                </label>
                <input
                  type="text"
                  placeholder="1.0"
                  value={docVersion}
                  onChange={(e) => setDocVersion(e.target.value)}
                  className={`w-full text-xs rounded-lg px-3 py-2 border focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${
                    isDark
                      ? 'bg-zinc-900 text-zinc-200 border-zinc-700 placeholder-zinc-500'
                      : 'bg-white text-zinc-900 border-zinc-300 placeholder-zinc-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                  Department
                </label>
                <input
                  type="text"
                  placeholder="e.g. QC, QA, Ops"
                  value={docDepartment}
                  onChange={(e) => setDocDepartment(e.target.value)}
                  className={`w-full text-xs rounded-lg px-3 py-2 border focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${
                    isDark
                      ? 'bg-zinc-900 text-zinc-200 border-zinc-700 placeholder-zinc-500'
                      : 'bg-white text-zinc-900 border-zinc-300 placeholder-zinc-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                  Status
                </label>
                <select
                  value={docStatus}
                  onChange={(e) => setDocStatus(e.target.value)}
                  className={`w-full text-xs rounded-lg px-3 py-2 border focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${
                    isDark
                      ? 'bg-zinc-900 text-zinc-200 border-zinc-700'
                      : 'bg-white text-zinc-900 border-zinc-300'
                  }`}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                isUploading || !selectedFile
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                    : 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20 cursor-pointer'
              }`}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing & Vectorizing with Gemini...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload & Ingest into Supabase</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Document Catalog List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>Available Documents ({filteredDocs.length})</span>
          </h2>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search filter */}
            <div className="relative flex-1 sm:w-52">
              <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
              <input
                type="text"
                placeholder="Filter documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full text-xs rounded-lg pl-8 pr-2.5 py-1.5 border focus:outline-none transition-colors ${
                  isDark
                    ? 'bg-zinc-900 text-zinc-200 border-zinc-700 focus:border-zinc-500 placeholder-zinc-500'
                    : 'bg-white text-zinc-900 border-zinc-300 focus:border-zinc-400 placeholder-zinc-400'
                }`}
              />
            </div>

            {/* Dept filter */}
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className={`text-xs rounded-lg px-2.5 py-1.5 border focus:outline-none transition-colors ${
                isDark
                  ? 'bg-zinc-900 text-zinc-200 border-zinc-700 focus:border-zinc-500'
                  : 'bg-white text-zinc-900 border-zinc-300 focus:border-zinc-400'
              }`}
            >
              <option value="">All Depts</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <div
            className={`text-center py-12 rounded-2xl border text-xs shadow-xs ${
              isDark
                ? 'bg-[#242424] border-zinc-800 text-zinc-400'
                : 'bg-white border-zinc-200 text-zinc-500'
            }`}
          >
            No SOP documents found matching your filter criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => (
              <div
                key={doc.document_id}
                className={`border rounded-2xl p-4.5 flex flex-col justify-between transition-all shadow-xs ${
                  isDark
                    ? 'bg-[#242424] border-zinc-700 hover:border-zinc-600'
                    : 'bg-white border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                          isDark
                            ? 'bg-emerald-950/60 border-emerald-500/20 text-emerald-400'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold truncate" title={doc.name}>
                          {doc.name}
                        </h3>
                        <p className={`text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {doc.filename}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        isDark
                          ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                          : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      v{doc.version || '1.0'}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 my-3">
                    {doc.department && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border ${
                          isDark
                            ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                            : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        <Building2 className={`w-3 h-3 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
                        {doc.department}
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md capitalize border ${
                        doc.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : isDark
                          ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}
                    >
                      {doc.status || 'Active'}
                    </span>
                    {doc.chunks_count !== undefined && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md border ${
                          isDark
                            ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        }`}
                      >
                        {doc.chunks_count} chunks
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions & Links */}
                <div
                  className={`pt-3 border-t flex items-center justify-between mt-2 ${
                    isDark ? 'border-zinc-800' : 'border-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setPreviewCitation({
                          document_id: doc.document_id,
                          document_name: doc.name,
                          filename: doc.filename,
                          version: doc.version,
                          department: doc.department || undefined,
                          file_url: doc.file_url || undefined,
                          content: `Standard Operating Procedure: ${doc.name}\nDepartment: ${doc.department || 'General'}\nVersion: ${doc.version || '1.0'}\nStatus: ${doc.status || 'active'}`,
                          page_number: 1,
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-500 font-medium hover:underline"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview SOP</span>
                    </button>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(doc.document_id, doc.name)}
                      disabled={deletingId === doc.document_id}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDark
                          ? 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800'
                          : 'text-zinc-400 hover:text-red-600 hover:bg-zinc-100'
                      }`}
                      title="Delete document"
                    >
                      {deletingId === doc.document_id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Highlight & Mask Inspector Modal */}
      <PdfHighlightViewerModal
        isOpen={Boolean(previewCitation)}
        citation={previewCitation}
        isAdmin={isAdmin}
        onClose={() => setPreviewCitation(null)}
      />
    </div>
  );
};
