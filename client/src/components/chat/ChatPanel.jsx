import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Paperclip, Search, Plus, MessageSquare, Users, FolderKanban, 
  Check, CheckCheck, Wifi, WifiOff, FileText, Image as ImageIcon, Download, X,
  ArrowLeft, Clock, AlertCircle
} from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useChatSocket } from '../../hooks/useChatSocket';
import { Button, LoadingBlock, InlineAlert, StatusBadge } from '../ui';
import { fmtDateTime, fullName } from '../../lib/format';
import { NewChatModal } from './NewChatModal';

export function ChatPanel({ projectId = null, defaultConversationId = null, className = '' }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, DIRECT, GROUP, PROJECT
  const [typingUsers, setTypingUsers] = useState({});
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Socket handlers
  const handleIncomingMessage = useCallback(({ conversationId, message }) => {
    if (activeConversation && String(activeConversation._id) === String(conversationId)) {
      setMessages(prev => {
        if (prev.some(m => String(m._id) === String(message._id))) return prev;
        const tempIdx = prev.findIndex(m => m.sending && m.body === message.body);
        if (tempIdx !== -1) {
          const updated = [...prev];
          updated[tempIdx] = message;
          return updated;
        }
        return [...prev, message];
      });
      setTimeout(scrollToBottom, 100);
      markRead({ conversationId });
    }

    setConversations(prev => prev.map(c => {
      if (String(c._id) === String(conversationId)) {
        const isCurrent = activeConversation && String(activeConversation._id) === String(conversationId);
        return {
          ...c,
          lastMessage: message,
          lastActivityAt: message.createdAt,
          unreadCount: isCurrent ? 0 : (c.unreadCount || 0) + 1
        };
      }
      return c;
    }));
  }, [activeConversation]);

  const handleReadEvent = useCallback(({ conversationId, userId }) => {
    if (activeConversation && String(activeConversation._id) === String(conversationId)) {
      setMessages(prev => prev.map(m => {
        if (String(m.senderId?._id || m.senderId) !== String(userId)) {
          const reads = m.readBy || [];
          if (!reads.some(r => String(r.userId) === String(userId))) {
            return { ...m, readBy: [...reads, { userId, readAt: new Date() }] };
          }
        }
        return m;
      }));
    }
  }, [activeConversation]);

  const handleTypingEvent = useCallback(({ conversationId, userId, isTyping }) => {
    if (activeConversation && String(activeConversation._id) === String(conversationId)) {
      setTypingUsers(prev => ({
        ...prev,
        [userId]: isTyping
      }));
    }
  }, [activeConversation]);

  const {
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage: socketSendMessage,
    sendTyping,
    markRead
  } = useChatSocket({
    onMessage: handleIncomingMessage,
    onRead: handleReadEvent,
    onTyping: handleTypingEvent
  });

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConv(true);
      setError(null);

      if (projectId) {
        // Project mode: directly fetch the project conversation
        const res = await api.get(`/projects/${projectId}/conversation`);
        const conv = res.data?.conversation || res.data;
        if (conv) {
          setConversations([conv]);
          setActiveConversation(conv);
        }
      } else {
        const res = await api.get('/chat/conversations');
        const list = res.data?.conversations || [];
        setConversations(list);

        if (defaultConversationId) {
          const target = list.find(c => String(c._id) === String(defaultConversationId));
          if (target) setActiveConversation(target);
          else if (list.length > 0) setActiveConversation(list[0]);
        } else if (!activeConversation && list.length > 0) {
          setActiveConversation(list[0]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoadingConv(false);
    }
  }, [projectId, defaultConversationId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when active conversation changes
  useEffect(() => {
    let active = true;
    async function fetchMessages() {
      if (!activeConversation?._id) return;
      try {
        setLoadingMessages(true);
        joinConversation(activeConversation._id);
        markRead({ conversationId: activeConversation._id });

        const res = await api.get(`/chat/conversations/${activeConversation._id}/messages`);
        if (active) {
          setMessages(res.data?.messages || []);
          setTimeout(scrollToBottom, 100);
        }
      } catch (err) {
        if (active) setError(err.message || 'Failed to load messages');
      } finally {
        if (active) setLoadingMessages(false);
      }
    }

    fetchMessages();

    return () => {
      active = false;
      if (activeConversation?._id) {
        leaveConversation(activeConversation._id);
      }
    };
  }, [activeConversation?._id, joinConversation, leaveConversation, markRead]);

  // Auto rejoin room when socket connects/reconnects
  useEffect(() => {
    if (isConnected && activeConversation?._id) {
      joinConversation(activeConversation._id);
    }
  }, [isConnected, activeConversation?._id, joinConversation]);

  // Handle typing indicator
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!activeConversation) return;

    sendTyping({ conversationId: activeConversation._id, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping({ conversationId: activeConversation._id, isTyping: false });
    }, 1500);
  };

  // Upload attachment
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingFile(true);
      const res = await api.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAttachments(prev => [...prev, res.data?.attachment || res.data]);
    } catch (err) {
      setError(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Send message with instantaneous optimistic UI update
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text && attachments.length === 0) return;
    if (!activeConversation?._id) return;

    const currentAttachments = [...attachments];
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      conversationId: activeConversation._id,
      senderId: { _id: user?._id, firstName: user?.firstName, lastName: user?.lastName, email: user?.email },
      body: text,
      attachments: currentAttachments,
      createdAt: new Date().toISOString(),
      sending: true
    };

    setInputText('');
    setAttachments([]);
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    sendTyping({ conversationId: activeConversation._id, isTyping: false });

    const payload = {
      conversationId: activeConversation._id,
      body: text,
      attachments: currentAttachments
    };

    try {
      let sent;
      if (isConnected) {
        sent = await socketSendMessage(payload);
      } else {
        // Fallback to HTTP REST
        const res = await api.post(`/chat/conversations/${activeConversation._id}/messages`, payload);
        sent = res.data?.chatMessage || res.data;
      }
      if (sent) {
        setMessages(prev => prev.map(m => m._id === tempId ? sent : m));
        setTimeout(scrollToBottom, 50);
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m._id === tempId ? { ...m, sending: false, failed: true } : m));
      setError(err.message || 'Failed to send message');
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (filterType !== 'ALL' && c.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const title = (c.name || '').toLowerCase();
      const memberNames = (c.members || []).map(m => fullName(m.userId)).join(' ').toLowerCase();
      return title.includes(q) || memberNames.includes(q);
    }
    return true;
  });

  const getConversationTitle = (c) => {
    if (!c) return 'Conversation';
    if (c.name) return c.name;
    if (c.type === 'DIRECT') {
      const other = (c.members || []).find(m => String(m.userId?._id || m.userId) !== String(user?._id));
      return other?.userId ? fullName(other.userId) : 'Direct Chat';
    }
    return 'Chat';
  };

  return (
    <div className={`flex h-[600px] border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden ${className}`}>
      {/* Sidebar (only if not pinned to a single project) */}
      {!projectId && (
        <div className={`w-full md:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50 ${activeConversation && mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-brand-600" />
                Conversations
              </h3>
              <Button
                size="xs"
                variant="primary"
                icon={Plus}
                onClick={() => setNewChatModalOpen(true)}
                data-testid="start-new-chat-btn"
              >
                New
              </Button>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search chats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                data-testid="chat-search-input"
              />
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-slate-400" />
            </div>
            {/* Filter pills */}
            <div className="flex gap-1">
              {['ALL', 'DIRECT', 'GROUP', 'PROJECT'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={`text-[11px] px-2 py-0.5 rounded font-medium transition ${
                    filterType === t 
                       ? 'bg-brand-600 text-white' 
                      : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/70'
                  }`}
                >
                  {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingConv ? (
              <LoadingBlock label="Loading chats..." />
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No conversations found. Click &quot;New&quot; to start collaborating.
              </div>
            ) : (
              filteredConversations.map(c => {
                const isSelected = activeConversation && String(activeConversation._id) === String(c._id);
                const title = getConversationTitle(c);
                const unread = c.unreadCount || 0;
                return (
                  <div
                    key={c._id}
                    onClick={() => {
                      setActiveConversation(c);
                      setMobileView('chat');
                    }}
                    className={`p-3 cursor-pointer transition flex items-start gap-3 ${
                      isSelected ? 'bg-brand-50/80 border-l-4 border-brand-600' : 'hover:bg-slate-100/60'
                    }`}
                    data-testid={`conversation-item-${c._id}`}
                  >
                    <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {c.type === 'DIRECT' ? (
                        title.slice(0, 2).toUpperCase()
                      ) : c.type === 'PROJECT' ? (
                        <FolderKanban className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Users className="h-4 w-4 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-900 truncate">{title}</p>
                        {c.lastActivityAt && (
                          <span className="text-[10px] text-slate-600 shrink-0">
                            {fmtDateTime(c.lastActivityAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-0.5">
                        {c.lastMessage ? c.lastMessage.body || '[Attachment]' : 'No messages yet'}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="bg-brand-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Main Chat Thread */}
      <div className={`flex-1 flex flex-col bg-white ${!activeConversation || mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
        {activeConversation ? (
          <>
            {/* Header */}
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-600 hover:bg-slate-200 shrink-0"
                  title="Back to conversations list"
                  data-testid="chat-mobile-back-btn"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {getConversationTitle(activeConversation).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900 truncate" data-testid="chat-header-title">
                    {getConversationTitle(activeConversation)}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {activeConversation.type === 'DIRECT'
                      ? 'Direct Collaboration'
                      : activeConversation.type === 'PROJECT'
                      ? 'Project Channel'
                      : `${activeConversation.members?.length || 0} participants`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <Wifi className="h-3.5 w-3.5" /> Live
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                      <WifiOff className="h-3.5 w-3.5" /> Offline
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Message History */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/20">
              {loadingMessages ? (
                <LoadingBlock label="Loading messages..." />
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <MessageSquare className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm font-medium">No messages in this chat yet.</p>
                  <p className="text-xs">Say hello or share project updates to kick off collaboration!</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = String(m.senderId?._id || m.senderId) === String(user?._id);
                  const senderName = m.senderId?.firstName ? fullName(m.senderId) : 'Colleague';
                  const isReadByOthers = (m.readBy || []).some(r => String(r.userId) !== String(user?._id));

                  return (
                    <div
                      key={m._id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      data-testid={`chat-message-${m._id}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-600">
                        <span className="font-medium text-slate-700">{isMine ? 'You' : senderName}</span>
                        <span>·</span>
                        <span>{fmtDateTime(m.createdAt)}</span>
                      </div>

                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                          isMine
                            ? 'bg-brand-600 text-white rounded-tr-none'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                        }`}
                      >
                        {m.body && <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>}

                        {/* Attachments */}
                        {m.attachments?.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {m.attachments.map((att, idx) => (
                              <a
                                key={idx}
                                href={`/api/v1/chat/attachment/${att.storedName}`}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition ${
                                  isMine
                                    ? 'bg-brand-700/60 hover:bg-brand-700 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                                }`}
                              >
                                {att.mimeType?.startsWith('image/') ? (
                                  <ImageIcon className="h-4 w-4 shrink-0" />
                                ) : (
                                  <FileText className="h-4 w-4 shrink-0" />
                                )}
                                <span className="truncate max-w-[180px]">{att.originalName}</span>
                                <Download className="h-3.5 w-3.5 shrink-0 ml-auto opacity-70" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Read status */}
                      {isMine && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-0.5">
                          {m.sending ? (
                            <span className="flex items-center text-slate-400">
                              <Clock className="h-3 w-3 inline mr-0.5 animate-spin" /> Sending...
                            </span>
                          ) : m.failed ? (
                            <span className="flex items-center text-rose-500 font-medium">
                              <AlertCircle className="h-3 w-3 inline mr-0.5" /> Failed
                            </span>
                          ) : isReadByOthers ? (
                            <span className="flex items-center text-brand-600 font-medium">
                              <CheckCheck className="h-3 w-3 inline mr-0.5" /> Read
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <Check className="h-3 w-3 inline mr-0.5" /> Delivered
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            {Object.entries(typingUsers).some(([uid, isTyping]) => isTyping && String(uid) !== String(user?._id)) && (
              <div className="px-4 py-1 text-[11px] text-slate-500 italic bg-slate-50 border-t border-slate-100">
                Someone is typing...
              </div>
            )}

            {/* Attachments staging bar */}
            {attachments.length > 0 && (
              <div className="px-3 py-2 bg-slate-100 border-t border-slate-200 flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded text-xs text-slate-700"
                  >
                    <FileText className="h-3.5 w-3.5 text-brand-600" />
                    <span className="truncate max-w-[150px]">{att.originalName}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-slate-400 hover:text-rose-600 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input area */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploadingFile}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={Paperclip}
                loading={uploadingFile}
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                data-testid="chat-attach-btn"
              />
              <input
                type="text"
                placeholder="Type a message... (Press Enter to send)"
                value={inputText}
                onChange={handleInputChange}
                className="flex-1 text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                data-testid="chat-message-input"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={Send}
                disabled={!inputText.trim() && attachments.length === 0}
                data-testid="chat-send-btn"
              >
                Send
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <MessageSquare className="h-12 w-12 text-slate-300 mb-3" />
            <h4 className="text-base font-semibold text-slate-700">Select a conversation</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Choose an existing chat from the left panel or click &quot;New&quot; to begin communicating with your team.
            </p>
          </div>
        )}
      </div>

      {newChatModalOpen && (
        <NewChatModal
          open
          onClose={() => setNewChatModalOpen(false)}
          onCreated={(newConv) => {
            setConversations(prev => [newConv, ...prev.filter(c => String(c._id) !== String(newConv._id))]);
            setActiveConversation(newConv);
          }}
        />
      )}
    </div>
  );
}
