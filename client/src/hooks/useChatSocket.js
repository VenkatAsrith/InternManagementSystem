import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { session } from '../lib/session';

export function useChatSocket({ onMessage, onRead, onTyping, onNotification, onPresence } = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const socketRef = useRef(null);

  const onMessageRef = useRef(onMessage);
  const onReadRef = useRef(onRead);
  const onTypingRef = useRef(onTyping);
  const onNotificationRef = useRef(onNotification);
  const onPresenceRef = useRef(onPresence);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onReadRef.current = onRead;
    onTypingRef.current = onTyping;
    onNotificationRef.current = onNotification;
    onPresenceRef.current = onPresence;
  }, [onMessage, onRead, onTyping, onNotification, onPresence]);

  useEffect(() => {
    const token = session.getToken();
    if (!token) {
      setIsConnected(false);
      return;
    }

    const socketUrl = (import.meta.env.VITE_API_URL || 'https://internmanagementsystem-xm84.onrender.com').replace(/\/+$/, '');
    const socket = io(socketUrl, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
      setConnectionError(err.message || 'Connection failed');
    });

    socket.on('chat:message', (payload) => {
      if (onMessageRef.current) {
        onMessageRef.current(payload);
      }
    });

    socket.on('chat:read', (payload) => {
      if (onReadRef.current) {
        onReadRef.current(payload);
      }
    });

    socket.on('chat:typing', (payload) => {
      if (onTypingRef.current) {
        onTypingRef.current(payload);
      }
    });

    socket.on('chat:notification', (payload) => {
      if (onNotificationRef.current) {
        onNotificationRef.current(payload);
      }
    });

    socket.on('user_presence', (payload) => {
      if (onPresenceRef.current) {
        onPresenceRef.current(payload);
      }
    });

    socket.on('presence_update', (payload) => {
      if (onPresenceRef.current) {
        onPresenceRef.current(payload);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinConversation = useCallback((conversationId) => {
    if (socketRef.current && isConnected && conversationId) {
      socketRef.current.emit('chat:join', { conversationId });
    }
  }, [isConnected]);

  const leaveConversation = useCallback((conversationId) => {
    if (socketRef.current && isConnected && conversationId) {
      socketRef.current.emit('chat:leave', { conversationId });
    }
  }, [isConnected]);

  const sendMessage = useCallback(({ conversationId, body, attachments, replyTo }) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !socketRef.current.connected) {
        return reject(new Error('Chat disconnected. Please wait for reconnect.'));
      }
      socketRef.current.emit('chat:send', { conversationId, body, attachments, replyTo }, (response) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response?.data);
        }
      });
    });
  }, []);

  const sendTyping = useCallback(({ conversationId, isTyping }) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:typing', { conversationId, isTyping });
    }
  }, []);

  const markRead = useCallback(({ conversationId }) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:read', { conversationId });
    }
  }, []);

  return {
    isConnected,
    connectionError,
    joinConversation,
    leaveConversation,
    sendMessage,
    sendTyping,
    markRead
  };
}
