'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatArea } from '@/components/ChatArea';
import { DocumentsManager } from '@/components/DocumentsManager';
import { UsersManager } from '@/components/UsersManager';
import { LoginModal } from '@/components/LoginModal';
import { User, DocumentItem, Conversation, Message } from '@/types';
import { api } from '@/lib/api';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'documents' | 'users'>('chat');
  const [isDark, setIsDark] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Load / Toggle Theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('sop_theme');
      const prefersDark = savedTheme ? savedTheme === 'dark' : true;
      setIsDark(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const handleToggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sop_theme', next ? 'dark' : 'light');
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      return next;
    });
  };

  // Documents
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // Filter state for chat
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');

  // Conversations & Chat State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState('');

  // 1. Load User Session on Start
  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken();
      if (!token) {
        setIsLoginOpen(true);
        return;
      }

      try {
        const user = await api.getMe();
        setCurrentUser(user);
      } catch {
        api.setToken(null);
        setIsLoginOpen(true);
      }
    };

    initAuth();
  }, []);

  // 2. Load Documents when authenticated
  const fetchDocuments = async () => {
    try {
      const data = await api.listDocuments();
      setDocuments(data);
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchDocuments();
    }
  }, [currentUser]);

  // 3. Load Conversations from Supabase Database (with local caching)
  const loadUserConversations = async (userId: string) => {
    try {
      const dbConversations = await api.listConversations();
      if (dbConversations && dbConversations.length > 0) {
        // Map database conversations
        const mappedConvs: Conversation[] = await Promise.all(
          dbConversations.map(async (c) => {
            let messages: Message[] = [];
            try {
              const msgs = await api.getConversationMessages(c.conversation_id);
              messages = msgs.map((m) => ({
                id: m.message_id,
                role: m.role,
                content: m.content,
                sources: m.sources,
                timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }));
            } catch {
              messages = [];
            }
            return {
              id: c.conversation_id,
              title: c.title,
              createdAt: c.created_at,
              departmentFilter: c.department_filter,
              documentIdFilter: c.document_id_filter,
              messages,
            };
          })
        );

        setConversations(mappedConvs);
        setActiveConversationId(mappedConvs[0].id);
        localStorage.setItem(`sop_conversations_${userId}`, JSON.stringify(mappedConvs));
        return;
      }
    } catch (e) {
      console.warn('Notice: Loading conversations from DB failed, using local cache:', e);
    }

    // Fallback to local storage if DB empty or offline
    const userStorageKey = `sop_conversations_${userId}`;
    const saved = localStorage.getItem(userStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          setActiveConversationId(parsed[0].id);
          return;
        }
      } catch {
        // ignore error
      }
    }

    // Initialize first conversation
    const initialId = `conv_${Date.now()}`;
    const initialConv: Conversation = {
      id: initialId,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      messages: [],
    };
    setConversations([initialConv]);
    setActiveConversationId(initialId);
    localStorage.setItem(userStorageKey, JSON.stringify([initialConv]));
  };

  useEffect(() => {
    if (currentUser?.user_id) {
      loadUserConversations(currentUser.user_id);
    } else {
      setConversations([]);
      setActiveConversationId(null);
    }
  }, [currentUser?.user_id]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentUser?.user_id && conversations.length > 0) {
      const userStorageKey = `sop_conversations_${currentUser.user_id}`;
      localStorage.setItem(userStorageKey, JSON.stringify(conversations));
    }
  }, [conversations, currentUser?.user_id]);

  // Active Conversation helper
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const currentMessages = activeConversation ? activeConversation.messages : [];

  // Create New Chat
  const handleNewChat = async () => {
    let newId = `conv_${Date.now()}`;
    let title = 'New Conversation';

    if (currentUser?.user_id) {
      try {
        const created = await api.createConversation({
          title: 'New Conversation',
          department_filter: selectedDepartment || undefined,
          document_id_filter: selectedDocId || undefined,
        });
        if (created?.conversation_id) {
          newId = created.conversation_id;
          title = created.title;
        }
      } catch (err) {
        console.warn('Notice: creating remote conversation:', err);
      }
    }

    const newConv: Conversation = {
      id: newId,
      title,
      createdAt: new Date().toISOString(),
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);
    setCurrentView('chat');
  };

  // Delete Conversation
  const handleDeleteConversation = async (id: string) => {
    if (id && !id.startsWith('conv_')) {
      try {
        await api.deleteConversation(id);
      } catch (err) {
        console.warn('Notice: deleting remote conversation:', err);
      }
    }

    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (remaining.length === 0 && currentUser?.user_id) {
        const freshId = `conv_${Date.now()}`;
        const freshConv: Conversation = {
          id: freshId,
          title: 'New Conversation',
          createdAt: new Date().toISOString(),
          messages: [],
        };
        setActiveConversationId(freshId);
        return [freshConv];
      }
      return remaining;
    });

    if (activeConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      }
    }
  };

  // Send Chat Message
  const handleSendMessage = async (text: string) => {
    let convId = activeConversationId;
    let targetConv = conversations.find((c) => c.id === convId);

    const isExistingUuid = convId && /^[0-9a-fA-F-]{36}$/.test(convId);
    let activeDbConvId = isExistingUuid ? convId : null;

    // 1. If not yet saved in DB, auto-create remote conversation in Supabase
    if (!activeDbConvId && currentUser?.user_id) {
      try {
        const snippet = text.length > 32 ? `${text.substring(0, 32)}...` : text;
        const created = await api.createConversation({
          title: snippet,
          department_filter: selectedDepartment || undefined,
          document_id_filter: selectedDocId || undefined,
        });
        if (created?.conversation_id) {
          activeDbConvId = created.conversation_id;
        }
      } catch (err) {
        console.warn('Notice: auto-creating database conversation for message:', err);
      }
    }

    const effectiveId = activeDbConvId || convId || `conv_${Date.now()}`;

    // 2. Set up initial conversation state if missing or newly promoted to UUID
    if (!targetConv) {
      targetConv = {
        id: effectiveId,
        title: text.length > 30 ? `${text.substring(0, 30)}...` : text,
        createdAt: new Date().toISOString(),
        messages: [],
      };
      setConversations((prev) => [targetConv!, ...prev]);
    } else if (effectiveId !== convId) {
      // Replace temporary ID with database UUID
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, id: effectiveId } : c))
      );
    }
    setActiveConversationId(effectiveId);

    const tempUserMsgId = `msg_${Date.now()}_user`;
    const userMessage: Message = {
      id: tempUserMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update UI immediately with user message
    const updatedMessagesWithUser = [...targetConv.messages, userMessage];
    const isFirstMessage = targetConv.messages.length === 0;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === effectiveId || c.id === convId
          ? {
              ...c,
              id: effectiveId,
              title: isFirstMessage
                ? text.length > 32
                  ? `${text.substring(0, 32)}...`
                  : text
                : c.title,
              messages: updatedMessagesWithUser,
            }
          : c
      )
    );

    setIsLoadingChat(true);

    try {
      let assistantMessage: Message;

      if (activeDbConvId) {
        // Send message through DB-backed endpoint -> Persists to chat_messages in Supabase
        const sendRes = await api.sendMessageToConversation(activeDbConvId, {
          content: text,
          department: selectedDepartment || undefined,
          document_id: selectedDocId || undefined,
        });

        // Update user message ID to DB generated ID
        const dbUserMsgId = sendRes.user_message.message_id;

        assistantMessage = {
          id: sendRes.assistant_message.message_id,
          role: 'assistant',
          content: sendRes.assistant_message.content,
          sources: sendRes.assistant_message.sources,
          timestamp: new Date(sendRes.assistant_message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === effectiveId) {
              const updatedMsgs = c.messages.map((m) =>
                m.id === tempUserMsgId ? { ...m, id: dbUserMsgId } : m
              );
              return {
                ...c,
                messages: [...updatedMsgs, assistantMessage],
              };
            }
            return c;
          })
        );
      } else {
        // Fallback for unauthenticated or offline mode
        const historyPayload = updatedMessagesWithUser.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await api.chatWithDocuments({
          message: text,
          history: historyPayload,
          department: selectedDepartment || undefined,
          document_id: selectedDocId || undefined,
          user_id: currentUser?.user_id,
          user_role: currentUser?.role || 'master_admin',
        });

        assistantMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: res.answer,
          sources: res.sources,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === effectiveId
              ? {
                  ...c,
                  messages: [...c.messages, assistantMessage],
                }
              : c
          )
        );
      }
    } catch (err: any) {
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: `⚠️ **Error retrieving SOP information:** ${err.message || 'Failed to connect to backend service.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === effectiveId
            ? {
                ...c,
                messages: [...c.messages, errorMessage],
              }
            : c
        )
      );
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleLogout = () => {
    api.setToken(null);
    setCurrentUser(null);
    setIsLoginOpen(true);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsLoginOpen(false);
    fetchDocuments();
    if (conversations.length === 0) {
      handleNewChat();
    }
  };

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden font-sans antialiased transition-colors duration-200 ${
        isDark ? 'bg-[#171717] text-zinc-100' : 'bg-white text-zinc-900'
      }`}
    >
      {/* Responsive Sidebar (Desktop Fixed + Mobile Slide-over Drawer) */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        currentUser={currentUser}
        onLogout={handleLogout}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        searchHistoryQuery={searchHistoryQuery}
        setSearchHistoryQuery={setSearchHistoryQuery}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 flex flex-col h-full overflow-hidden transition-colors duration-200 ${
          isDark ? 'bg-[#212121]' : 'bg-white'
        }`}
      >
        {currentView === 'chat' && (
          <ChatArea
            messages={currentMessages}
            isLoading={isLoadingChat}
            onSendMessage={handleSendMessage}
            availableDocuments={documents}
            selectedDepartment={selectedDepartment}
            setSelectedDepartment={setSelectedDepartment}
            selectedDocId={selectedDocId}
            setSelectedDocId={setSelectedDocId}
            currentUser={currentUser}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
            onOpenMobileMenu={() => setIsMobileOpen(true)}
          />
        )}

        {currentView === 'documents' && (currentUser?.role === 'master_admin' || currentUser?.role === 'admin') && (
          <DocumentsManager
            documents={documents}
            currentUser={currentUser}
            onRefresh={fetchDocuments}
            onOpenMobileMenu={() => setIsMobileOpen(true)}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
          />
        )}

        {currentView === 'users' && (currentUser?.role === 'master_admin' || currentUser?.role === 'admin') && (
          <UsersManager
            currentUser={currentUser}
            documents={documents}
            onOpenMobileMenu={() => setIsMobileOpen(true)}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
          />
        )}
      </main>

      {/* Login / Auth Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
