'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  UserCheck, 
  Briefcase, 
  Trash2, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  KeyRound,
  FileText,
  Menu,
  Sun,
  Moon
} from 'lucide-react';
import { User, DocumentItem } from '@/types';
import { api } from '@/lib/api';

interface UsersManagerProps {
  currentUser: User | null;
  documents: DocumentItem[];
  onOpenMobileMenu?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const UsersManager: React.FC<UsersManagerProps> = ({
  currentUser,
  documents,
  onOpenMobileMenu,
  isDark = true,
  onToggleTheme,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New user form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [department, setDepartment] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Edit Access Modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDocIds, setEditDocIds] = useState<string[]>([]);
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  const isMasterAdmin = currentUser?.role === 'master_admin' || currentUser?.is_master_admin;

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch users.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const toggleEditDocSelection = (docId: string) => {
    setEditDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setFeedback({ type: 'error', message: 'Email and password are required.' });
      return;
    }

    setIsCreating(true);
    setFeedback(null);

    try {
      await api.createUser({
        email,
        password,
        full_name: fullName,
        role,
        department,
        document_ids: role === 'employee' ? selectedDocIds : [],
      });
      setFeedback({
        type: 'success',
        message: `User '${email}' created successfully with role '${role}'.`,
      });
      setEmail('');
      setPassword('');
      setFullName('');
      setDepartment('');
      setSelectedDocIds([]);
      fetchUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create user.' });
    } finally {
      setIsCreating(false);
    }
  };

  const openEditAccessModal = (user: User) => {
    setEditingUser(user);
    const existingIds = (user.accessible_documents || []).map((d) => d.document_id);
    setEditDocIds(existingIds);
  };

  const handleSaveAccess = async () => {
    if (!editingUser) return;
    setIsSavingAccess(true);
    try {
      await api.updateUserAccess(editingUser.user_id, editDocIds);
      setFeedback({
        type: 'success',
        message: `Updated document permissions for ${editingUser.email}.`,
      });
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update access.' });
    } finally {
      setIsSavingAccess(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}?`)) return;
    try {
      await api.deleteUser(userId);
      setFeedback({ type: 'success', message: `User ${userEmail} deleted.` });
      fetchUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete user.' });
    }
  };

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
              <Users className="w-5 h-5 text-emerald-500" />
              <span>Role-Based User & Access Management</span>
            </h1>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Create admins and employees, and grant granular access to specific SOP documents.
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
            onClick={fetchUsers}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shadow-xs ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                : 'bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-200'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Users</span>
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

      {/* Create User Card */}
      <div
        className={`border rounded-2xl p-6 transition-colors shadow-xs ${
          isDark ? 'bg-[#242424] border-zinc-700' : 'bg-white border-zinc-200'
        }`}
      >
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-semibold">Create New Account</h2>
        </div>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="user@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full text-xs rounded-lg px-3 py-2 border focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${
                  isDark
                    ? 'bg-zinc-900 text-zinc-200 border-zinc-700 placeholder-zinc-500'
                    : 'bg-white text-zinc-900 border-zinc-300 placeholder-zinc-400'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                Password *
              </label>
              <input
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full text-xs rounded-lg px-3 py-2 border focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${
                  isDark
                    ? 'bg-zinc-900 text-zinc-200 border-zinc-700 placeholder-zinc-500'
                    : 'bg-white text-zinc-900 border-zinc-300 placeholder-zinc-400'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full text-xs rounded-lg px-3 py-2 border focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${
                  isDark
                    ? 'bg-zinc-900 text-zinc-200 border-zinc-700 placeholder-zinc-500'
                    : 'bg-white text-zinc-900 border-zinc-300 placeholder-zinc-400'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'employee')}
                className={`w-full text-xs rounded-lg px-3 py-2 border focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${
                  isDark
                    ? 'bg-zinc-900 text-zinc-200 border-zinc-700'
                    : 'bg-white text-zinc-900 border-zinc-300'
                }`}
              >
                <option value="employee">Employee (Selective document access)</option>
                {isMasterAdmin && <option value="admin">Admin (Full document access)</option>}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                Department
              </label>
              <input
                type="text"
                placeholder="e.g. QC, Production, QA"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={`w-full text-xs rounded-lg px-3 py-2 border focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${
                  isDark
                    ? 'bg-zinc-900 text-zinc-200 border-zinc-700 placeholder-zinc-500'
                    : 'bg-white text-zinc-900 border-zinc-300 placeholder-zinc-400'
                }`}
              />
            </div>
          </div>

          {/* Document Access Multi-Select for Employees */}
          {role === 'employee' && (
            <div className="pt-2">
              <label className={`block text-xs font-semibold mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>
                Grant Access to Specific SOP Documents:
              </label>

              {documents.length === 0 ? (
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>No documents uploaded yet.</p>
              ) : (
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2.5 rounded-xl border ${
                    isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  {documents.map((doc) => {
                    const isChecked = selectedDocIds.includes(doc.document_id);
                    return (
                      <div
                        key={doc.document_id}
                        onClick={() => toggleDocSelection(doc.document_id)}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs border transition-colors ${
                          isChecked
                            ? isDark
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : isDark
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isChecked
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : isDark
                              ? 'border-zinc-600 bg-zinc-800'
                              : 'border-zinc-300 bg-zinc-100'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="truncate font-medium">{doc.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isCreating}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              isCreating
                ? isDark
                  ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                  : 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20 cursor-pointer'
            }`}
          >
            {isCreating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Creating User...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create User</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-500" />
          <span>Registered Users ({users.length})</span>
        </h2>

        <div
          className={`border rounded-2xl overflow-hidden transition-colors shadow-xs ${
            isDark ? 'bg-[#242424] border-zinc-700' : 'bg-white border-zinc-200'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`font-semibold border-b transition-colors ${
                  isDark
                    ? 'bg-zinc-900/80 text-zinc-400 border-zinc-800'
                    : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                }`}
              >
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Accessible SOPs</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y transition-colors ${
                  isDark ? 'divide-zinc-800/60 text-zinc-300' : 'divide-zinc-200 text-zinc-700'
                }`}
              >
                {users.map((u) => (
                  <tr
                    key={u.user_id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <td className="p-3.5">
                      <div className={`font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {u.full_name || u.email.split('@')[0]}
                      </div>
                      <div className="text-[11px] text-zinc-500">{u.email}</div>
                    </td>

                    <td className="p-3.5">
                      {u.role === 'master_admin' || u.is_master_admin ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                          <ShieldCheck className="w-3 h-3" /> Master Admin
                        </span>
                      ) : u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <Briefcase className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/20">
                          <UserCheck className="w-3 h-3" /> Employee
                        </span>
                      )}
                    </td>

                    <td className="p-3.5">{u.department || '—'}</td>

                    <td className="p-3.5">
                      {u.role === 'master_admin' || u.role === 'admin' ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          All Documents (Unrestricted)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {u.accessible_documents && u.accessible_documents.length > 0 ? (
                            u.accessible_documents.map((doc, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border truncate max-w-[120px] ${
                                  isDark
                                    ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                    : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                }`}
                                title={doc.name || doc.filename}
                              >
                                <FileText className={`w-2.5 h-2.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
                                <span className="truncate">{doc.name || doc.filename}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-zinc-500">Public documents only</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.role === 'employee' && (
                          <button
                            onClick={() => openEditAccessModal(u)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                              isDark
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700'
                                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border-zinc-300'
                            }`}
                          >
                            Edit Access
                          </button>
                        )}

                        {(!u.is_master_admin && u.role !== 'master_admin') && (
                          <button
                            onClick={() => handleDeleteUser(u.user_id, u.email)}
                            className={`p-1 rounded-lg transition-colors ${
                              isDark
                                ? 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800'
                                : 'text-zinc-400 hover:text-red-600 hover:bg-zinc-100'
                            }`}
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Access Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div
            className={`border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 ${
              isDark ? 'bg-[#242424] border-zinc-700 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
            }`}
          >
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-500" />
                <span>Edit Document Permissions for {editingUser.email}</span>
              </h3>
              <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Select which SOP documents this employee is allowed to query and view.
              </p>
            </div>

            <div
              className={`space-y-2 max-h-60 overflow-y-auto p-2.5 rounded-xl border ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              {documents.map((doc) => {
                const isChecked = editDocIds.includes(doc.document_id);
                return (
                  <div
                    key={doc.document_id}
                    onClick={() => toggleEditDocSelection(doc.document_id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer text-xs border transition-colors ${
                      isChecked
                        ? isDark
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border ${
                        isChecked
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : isDark
                          ? 'border-zinc-600 bg-zinc-800'
                          : 'border-zinc-300 bg-zinc-100'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{doc.name}</p>
                      <p className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {doc.department || 'General'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className={`px-4 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAccess}
                disabled={isSavingAccess}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                {isSavingAccess ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Permissions</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
