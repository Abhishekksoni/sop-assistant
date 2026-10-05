'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  MessageSquare, 
  FileText, 
  Users, 
  LogOut, 
  Trash2, 
  ShieldCheck, 
  UserCheck, 
  Shield,
  Search,
  Sun,
  Moon,
  X,
  MoreHorizontal,
  FolderLock
} from 'lucide-react';
import { User, Conversation } from '@/types';

interface SidebarProps {
  currentView: 'chat' | 'documents' | 'users';
  setCurrentView: (view: 'chat' | 'documents' | 'users') => void;
  currentUser: User | null;
  onLogout: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  searchHistoryQuery: string;
  setSearchHistoryQuery: (q: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  currentUser,
  onLogout,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  searchHistoryQuery,
  setSearchHistoryQuery,
  isDark,
  onToggleTheme,
  isMobileOpen,
  onCloseMobile,
}) => {
  const isMasterAdmin = currentUser?.role === 'master_admin' || currentUser?.is_master_admin;
  const isAdmin = isMasterAdmin || currentUser?.role === 'admin';
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchHistoryQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Main Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 lg:w-72 flex flex-col h-full select-none transition-transform duration-300 ease-in-out border-r ${
          isDark
            ? 'bg-[#171717] border-[#2f2f2f] text-zinc-200'
            : 'bg-[#f9f9f9] border-[#e5e5e5] text-zinc-800'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Top Header: Brand & Mobile Close */}
        <div className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-950/20 text-white font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                <span>SOP Intelligence</span>
              </h1>
              <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {currentUser?.role === 'master_admin'
                  ? 'Master Admin Workspace'
                  : currentUser?.role === 'admin'
                  ? 'Admin Workspace'
                  : 'Employee Workspace'}
              </p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className={`p-1.5 rounded-lg md:hidden ${
              isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action: New Chat Button (ChatGPT Style) */}
        <div className="px-3 pt-1 pb-2">
          <button
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all border shadow-xs ${
              isDark
                ? 'bg-[#212121] hover:bg-[#2a2a2a] text-zinc-100 border-[#2f2f2f] hover:border-zinc-600'
                : 'bg-white hover:bg-zinc-50 text-zinc-800 border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2.5 font-semibold">
              <Plus className="w-4 h-4 text-emerald-500" />
              <span>New chat</span>
            </div>
            <kbd
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation Switcher Tabs */}
        <div
          className={`px-3 py-2 flex flex-col gap-1 border-b ${
            isDark ? 'border-[#2a2a2a]' : 'border-zinc-200'
          }`}
        >
          <button
            onClick={() => {
              setCurrentView('chat');
              onCloseMobile();
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentView === 'chat'
                ? isDark
                  ? 'bg-[#2a2a2a] text-white shadow-xs'
                  : 'bg-zinc-200/80 text-zinc-900 font-semibold'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-[#212121]'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            <span>AI Chat Assistant</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setCurrentView('documents');
                onCloseMobile();
              }}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                currentView === 'documents'
                  ? isDark
                    ? 'bg-[#2a2a2a] text-white shadow-xs'
                    : 'bg-zinc-200/80 text-zinc-900 font-semibold'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-[#212121]'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-emerald-500" />
                <span>SOP Documents</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                }`}
              >
                Upload
              </span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => {
                setCurrentView('users');
                onCloseMobile();
              }}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                currentView === 'users'
                  ? isDark
                    ? 'bg-[#2a2a2a] text-white shadow-xs'
                    : 'bg-zinc-200/80 text-zinc-900 font-semibold'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-[#212121]'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-emerald-500" />
                <span>Users & Permissions</span>
              </div>
              <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-mono border border-amber-500/20">
                Admin
              </span>
            </button>
          )}
        </div>

        {/* History Search Bar */}
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search
              className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            />
            <input
              type="text"
              placeholder="Search chat history..."
              value={searchHistoryQuery}
              onChange={(e) => setSearchHistoryQuery(e.target.value)}
              className={`w-full text-xs rounded-lg pl-8 pr-3 py-1.5 border focus:outline-none transition-colors ${
                isDark
                  ? 'bg-[#121212] border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/60'
                  : 'bg-white border-zinc-200 text-zinc-800 placeholder-zinc-400 focus:border-emerald-500/60'
              }`}
            />
          </div>
        </div>

        {/* Scrollable Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 scrollbar-thin">
          <div
            className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`}
          >
            Recent Chats ({filteredConversations.length})
          </div>

          {filteredConversations.length === 0 ? (
            <div
              className={`text-center py-8 text-xs ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const isHovered = hoveredConvId === conv.id;

              return (
                <div
                  key={conv.id}
                  onMouseEnter={() => setHoveredConvId(conv.id)}
                  onMouseLeave={() => setHoveredConvId(null)}
                  className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-xs cursor-pointer transition-all ${
                    isActive
                      ? isDark
                        ? 'bg-[#2a2a2a] text-white font-medium shadow-xs'
                        : 'bg-zinc-200 text-zinc-900 font-semibold'
                      : isDark
                      ? 'text-zinc-300 hover:bg-[#212121] hover:text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    setCurrentView('chat');
                    onCloseMobile();
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{conv.title}</span>
                  </div>

                  {/* Delete Button on Hover/Active */}
                  {(isHovered || isActive) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className={`p-1 rounded-md transition-colors ${
                        isDark
                          ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-700'
                          : 'text-zinc-400 hover:text-red-500 hover:bg-zinc-300'
                      }`}
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: User Profile & Theme Switcher */}
        <div
          className={`p-3 border-t flex flex-col gap-2 ${
            isDark ? 'border-[#2a2a2a] bg-[#141414]' : 'border-zinc-200 bg-zinc-100/70'
          }`}
        >
          {/* User Info Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                  currentUser?.role === 'master_admin'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : currentUser?.role === 'admin'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {currentUser?.email ? currentUser.email.substring(0, 2) : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate leading-tight">
                  {currentUser?.full_name || currentUser?.email || 'User'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono capitalize ${
                      currentUser?.role === 'master_admin'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold'
                        : currentUser?.role === 'admin'
                        ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {currentUser?.role === 'master_admin' ? 'Master Admin' : currentUser?.role || 'Employee'}
                  </span>
                </div>
              </div>
            </div>

            {/* Theme Toggle & Logout */}
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleTheme}
                className={`p-2 rounded-lg transition-colors ${
                  isDark
                    ? 'text-zinc-400 hover:text-amber-300 hover:bg-zinc-800'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200'
                }`}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={onLogout}
                className={`p-2 rounded-lg transition-colors ${
                  isDark
                    ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-800'
                    : 'text-zinc-500 hover:text-red-500 hover:bg-zinc-200'
                }`}
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
