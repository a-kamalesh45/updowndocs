'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import { io } from 'socket.io-client';
import { compressSync, decompressSync } from 'fflate';
import { ArrowLeft, Share2, History as HistoryIcon, MoreHorizontal } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import CollaboratorAvatars from '../../components/editor/CollaboratorAvatars';
import ConnectionStatus, { ConnectionTone } from '../../components/editor/ConnectionStatus';
import ShareModal from '../../components/editor/ShareModal';
import HistoryDrawer, { VersionItem } from '../../components/editor/HistoryDrawer';
import RestoreConfirmModal from '../../components/editor/RestoreConfirmModal';
import BubbleToolbar from '../../components/editor/BubbleToolbar';
import SlashMenu from '../../components/editor/SlashMenu';

// Manuscript-editorial palette
const INK = '#1C1B1A';
const PAPER = '#FAF8F3';
const PAPER_RAISED = '#FFFFFF';
const RUST = '#C4502A';
const TAUPE = '#8A8578';
const HAIRLINE = '#E3DDD0';

// Safe Base64 encoder preventing Maximum Call Stack Size Exceeded errors
const uint8ToBase64 = (uint8Array: Uint8Array) => {
  const chunkSize = 8192;
  let str = '';
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    str += String.fromCharCode.apply(null, Array.from(uint8Array.subarray(i, i + chunkSize)));
  }
  return btoa(str);
};

export default function DocumentPage() {
  const params = useParams();
  const documentId = params.id as string;
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // Core CRDT State
  const ydoc = useMemo(() => new Y.Doc(), []);
  const awareness = useMemo(() => new Awareness(ydoc), [ydoc]);

  const { showToast } = useToast();

  const [documentMeta, setDocumentMeta] = useState<{ title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<null | 'forbidden' | 'notfound' | 'network'>(null);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'syncing' | 'offline'>('syncing');
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'reconnecting' | 'offline'>('connecting');
  const wasConnectedRef = useRef(false);

  const [localUser, setLocalUser] = useState({ name: 'Connecting...', color: TAUPE });

  // Editable title state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleSaveState, setTitleSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const titleSavingRef = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // STAGE 7: Version History State
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

  // STAGE 8: Sharing & Role State
  const [myRole, setMyRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'editor' | 'viewer'>('viewer');
  const [sharing, setSharing] = useState(false);

  // Restore-confirmation flow (replaces window.confirm)
  const [restoreTarget, setRestoreTarget] = useState<VersionItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Chrome-only presentation state
  const [scrolled, setScrolled] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // @ts-ignore
        history: false,
      }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({
        provider: { awareness },
        user: localUser
      }),
      Placeholder.configure({
        placeholder: 'Start writing or type / for commands',
        emptyNodeClass: 'before:content-[attr(data-placeholder)] before:text-[#C2BCAE] before:float-left before:pointer-events-none before:h-0'
      })
    ],
    editorProps: {
      attributes: {
        class: 'manuscript-prose max-w-none focus:outline-none min-h-[320px]',
      },
    },
    onUpdate: () => {
      setSyncStatus('syncing');
      awareness.setLocalStateField('typing', true);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        awareness.setLocalStateField('typing', false);
      }, 1500);
    }
  }, [localUser]);

  // STAGE 8: Dynamically lock the editor if the user is a viewer
  useEffect(() => {
    if (editor && myRole) {
      editor.setEditable(myRole === 'owner' || myRole === 'editor');
    }
  }, [editor, myRole]);

  // Inline title editing — click to rename, like the editor header of any modern doc app.
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  // Sticky header gains a stronger surface once the document scrolls beneath it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const canRename = myRole === 'owner' || myRole === 'editor';

  const startTitleEdit = () => {
    if (!canRename || !documentMeta) return;
    setTitleDraft(documentMeta.title);
    setEditingTitle(true);
  };

  const cancelTitleEdit = () => setEditingTitle(false);

  const saveTitle = async () => {
    if (titleSavingRef.current) return;
    setEditingTitle(false);

    const trimmed = titleDraft.trim();
    if (!trimmed || !documentMeta || trimmed === documentMeta.title) return;

    const previousTitle = documentMeta.title;
    setDocumentMeta({ title: trimmed });

    const token = localStorage.getItem('token');
    titleSavingRef.current = true;
    setTitleSaveState('saving');

    try {
      const res = await fetch(`${API_URL}/documents/${documentId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });

      if (!res.ok) throw new Error();

      setTitleSaveState('saved');
      setTimeout(() => setTitleSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (err) {
      setDocumentMeta({ title: previousTitle });
      setTitleSaveState('idle');
      showToast("Couldn't rename document.", 'error');
    } finally {
      titleSavingRef.current = false;
    }
  };

  // Rest API Cold Storage Fetching & Saving
  const saveDocumentContent = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const state = Y.encodeStateAsUpdate(ydoc);
    const base64Update = uint8ToBase64(state); // <-- USE HELPER HERE

    try {
      await fetch(`${API_URL}/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: base64Update })
      });
      setSyncStatus('saved');
    } catch (err) {
      setSyncStatus('offline');
    }
  };

  const fetchVersions = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/documents/${documentId}/versions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setVersions(await res.json());
    } catch (err) { console.error('Failed to fetch versions', err); }
  };

  const createSnapshot = async () => {
    const token = localStorage.getItem('token');
    const content = editor?.getJSON();
    try {
      await fetch(`${API_URL}/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      fetchVersions();
    } catch (err) { console.error('Failed to save snapshot', err); }
  };

 const restoreVersion = async (versionId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // 1. Save current state just in case
      await createSnapshot();

      // 2. Call the NEW backend restore route
      const res = await fetch(`${API_URL}/documents/${documentId}/versions/${versionId}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setShowHistory(false);
        showToast('Version restored', 'success');
        // We do NOT use setContent here anymore.
        // The server will emit 'document-restored' and the socket listener handles it.
      } else {
        showToast("Couldn't restore version.", 'error');
      }
    } catch (err) {
      console.error('Failed to restore version', err);
      showToast("Couldn't restore version.", 'error');
    }
  };

  // Restore now goes through a confirmation modal instead of window.confirm().
  const requestRestore = (version: VersionItem) => setRestoreTarget(version);
  const cancelRestore = () => {
    if (restoring) return;
    setRestoreTarget(null);
  };
  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    await restoreVersion(restoreTarget.id);
    setRestoring(false);
    setRestoreTarget(null);
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setSharing(true);

    try {
      const res = await fetch(`${API_URL}/documents/${documentId}/share`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail, role: shareRole })
      });

      if (res.ok) {
        showToast('Invitation sent', 'success');
        setShowShareModal(false);
        setShareEmail('');
      } else {
        const errData = await res.json();
        showToast(errData.error || "Couldn't send invitation.", 'error');
      }
    } catch (err) {
      console.error('Share error', err);
      showToast("Couldn't send invitation.", 'error');
    } finally {
      setSharing(false);
    }
  };

  // Main Effect: Network & Identity
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/auth');

    // --- Identity Setup ---
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.userId;

    const userColors = ['#C4502A', '#2F5233', '#1D4E89', '#7A4B8A', '#A6762E', '#3A6E6E'];
    const colorIndex = Array.from(userId).reduce((acc: number, char: any) => acc + char.charCodeAt(0), 0) % userColors.length;
    const myColor = userColors[colorIndex];

    const socket = io(API_URL, { auth: { token } });

    // CRITICAL: You must emit this so the backend puts you in the Socket.io room!
    socket.emit('join-document', documentId);

    // --- Real connection state (drives the header status indicator) ---
    socket.on('connect', () => {
      setConnectionState('connected');
      if (wasConnectedRef.current) {
        showToast('Connection restored', 'success');
      }
      wasConnectedRef.current = true;
    });
    socket.on('disconnect', () => {
      setConnectionState('reconnecting');
    });
    socket.io.on('reconnect_attempt', (attempt: number) => {
      setConnectionState(attempt > 3 ? 'offline' : 'reconnecting');
    });

    let persistentUser = { name: `User ${userId.substring(0, 4)}`, color: myColor };
    setLocalUser(persistentUser);
    awareness.setLocalState({ user: persistentUser, typing: false });

    // Fetch real name
    fetch(`${API_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(({ user }) => {
        persistentUser = { name: user.name, color: myColor };
        setLocalUser(persistentUser);
        awareness.setLocalState({ user: persistentUser, typing: false });
      })
      .catch(() => { });

    // Instantly catch mid-session role downgrades
    socket.on('permissions-updated', (data: any) => {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (data.userId === payload.userId) {
        setMyRole(data.newRole);
        if (data.newRole === 'viewer') {
          editor?.setEditable(false);
          showToast('Your permissions have been downgraded to Viewer.', 'info');
        }
      }
    });


    // --- CRDT Epoch Restoration ---
    socket.on('document-restored', (base64State) => {
      const binaryString = atob(base64State);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      Y.applyUpdate(ydoc, bytes);
      
      // Optionally, you can trigger a React state change here to force TipTap to re-render
      // e.g., setDocEpoch(prev => prev + 1);
    });

    // --- Throttled Cold Storage Saving ---
    // --- Outbound: Compress before emitting ---
    ydoc.on('update', (update) => {
      const compressedUpdate = compressSync(update);
      socket.emit('yjs-update', { documentId, update: Array.from(compressedUpdate) });
      
      if (!saveTimeoutRef.current) {
        saveTimeoutRef.current = setTimeout(() => {
          saveDocumentContent();
          saveTimeoutRef.current = null;
        }, 5000);
      }
    });

    

    fetchVersions();

    // --- WebSocket Relay Listeners ---
    // 1. Receive document text updates from other users
   // --- Inbound: Decompress upon receipt ---
    socket.on('yjs-update', (compressedUpdate) => {
      const decompressed = decompressSync(new Uint8Array(compressedUpdate));
      Y.applyUpdate(ydoc, decompressed);
    });
    // 2. Broadcast your cursor/typing presence to the server
    awareness.on('update', (changes: any, origin: any) => {
      if (origin === socket) return;
      const update = encodeAwarenessUpdate(awareness, changes.added.concat(changes.updated, changes.removed));
      socket.emit('awareness-update', { documentId, update: Array.from(update) });
    });

    // 3. Receive other users' cursors/typing presence from the server
    socket.on('awareness-update', (update) => {
      applyAwarenessUpdate(awareness, new Uint8Array(update), socket);
    });

    // --- Presence UI Updates ---
    awareness.on('change', () => {
      const entries = Array.from(awareness.getStates().entries());
      const validUsers = entries.filter(([, s]: any) => s.user && s.user.name);
      setActiveUsers(validUsers);
    });

    // --- Initial Cold Storage Fetch ---
    fetch(`${API_URL}/documents/${documentId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem('token');
          router.push('/auth');
          return null;
        }
        if (res.status === 403) {
          setLoadError('forbidden');
          setLoading(false);
          return null;
        }
        if (res.status === 404) {
          setLoadError('notfound');
          setLoading(false);
          return null;
        }
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setDocumentMeta({ title: data.title });
        setMyRole(data.myRole);
        if (data.content?.update) Y.applyUpdate(ydoc, new Uint8Array(data.content.update));
        setLoading(false);
      })
      .catch(() => {
        setLoadError('network');
        setLoading(false);
      });

    return () => {
      // Flush any unsaved content before tearing down — the 5s debounce timer
      // would otherwise keep running against an already-destroyed ydoc.
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        saveDocumentContent();
      }
      socket.disconnect();
      ydoc.destroy();
      awareness.destroy();
    };
  }, [ydoc, awareness, documentId, router, API_URL]);

  if (loadError) {
    const info = {
      forbidden: {
        title: "You don't have access to this document",
        body: 'Ask the owner to share it with you, or head back to your documents.',
        retry: false,
      },
      notfound: {
        title: 'Document not found',
        body: 'It may have been deleted, or the link is incorrect.',
        retry: false,
      },
      network: {
        title: "Couldn't load this document",
        body: 'Check your connection and try again.',
        retry: true,
      },
    }[loadError];

    return (
      <div className="h-screen w-full flex items-center justify-center px-6" style={{ backgroundColor: PAPER }}>
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <h2 className="font-serif text-lg" style={{ color: INK }}>{info.title}</h2>
          <p className="text-[13px] leading-relaxed" style={{ color: TAUPE }}>{info.body}</p>
          <div className="mt-3 flex items-center gap-3">
            {info.retry && (
              <button
                onClick={() => window.location.reload()}
                className="rounded-[6px] px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: INK, color: PAPER }}
              >
                Try Again
              </button>
            )}
            <Link
              href="/dashboard"
              className="rounded-[6px] border px-4 py-2 text-[13px] font-medium transition-colors"
              style={{ borderColor: HAIRLINE, color: INK }}
            >
              Back to Documents
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !editor) return (
    <div className="min-h-screen w-full px-6 pt-24" style={{ backgroundColor: PAPER }}>
      <div className="mx-auto flex max-w-[820px] flex-col items-center gap-4">
        <div className="h-6 w-48 animate-shimmer rounded-full" />
        <div className="mt-4 min-h-[640px] w-full animate-shimmer rounded-[12px]" style={{ border: `1px solid ${HAIRLINE}` }} />
        <span className="mt-2 text-[12px]" style={{ color: TAUPE }}>Opening document…</span>
      </div>
    </div>
  );

  const typingUsers = activeUsers.filter(([, s]: any) => s.typing && s.user?.name !== localUser.name);
  const typingLabel = typingUsers.length === 1
    ? `${typingUsers[0][1].user.name} is writing…`
    : typingUsers.length > 1
    ? `${typingUsers.map(([, s]: any) => s.user.name).join(', ')} are writing…`
    : '';

  const connectionStatus: { label: string; tone: ConnectionTone; spinning?: boolean } =
    connectionState === 'offline'
      ? { label: 'Offline', tone: 'negative' }
      : connectionState === 'reconnecting'
      ? { label: 'Reconnecting…', tone: 'warning', spinning: true }
      : connectionState === 'connecting'
      ? { label: 'Connecting…', tone: 'neutral', spinning: true }
      : syncStatus === 'syncing'
      ? { label: 'Syncing', tone: 'warning', spinning: true }
      : syncStatus === 'offline'
      ? { label: 'Save failed', tone: 'negative' }
      : { label: 'Saved', tone: 'positive' };

  return (
    <div className="min-h-screen pb-32 flex relative overflow-hidden" style={{ backgroundColor: PAPER }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap" />
      <style>{`
        .manuscript-prose { font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif; font-size: 1.0625rem; line-height: 1.75; color: ${INK}; }
        .manuscript-prose h1, .manuscript-prose h2, .manuscript-prose h3 { font-family: 'Source Serif 4', Georgia, serif; font-weight: 600; letter-spacing: -0.01em; color: ${INK}; }
        .manuscript-prose h1 { font-size: 1.85rem; margin: 1.6em 0 0.6em; }
        .manuscript-prose h2 { font-size: 1.4rem; margin: 1.4em 0 0.5em; }
        .manuscript-prose p { margin: 0.85em 0; }
        .manuscript-prose a { color: ${RUST}; text-decoration: underline; text-decoration-color: ${HAIRLINE}; }
        .manuscript-prose code { font-family: 'IBM Plex Mono', ui-monospace, monospace; background: #F0EBE0; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.85em; }
        .manuscript-prose ul, .manuscript-prose ol { padding-left: 1.4em; margin: 0.85em 0; }
        .manuscript-prose ::selection { background: #F0D4C4; color: ${INK}; }
        .font-mono { font-family: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace !important; }
        .tiptap .collaboration-carets__caret { border-left: 1.5px solid currentColor; border-right: 1.5px solid currentColor; margin-left: -1.5px; margin-right: -1.5px; pointer-events: none; position: relative; word-break: normal; }
        .tiptap .collaboration-carets__label { position: absolute; top: -1.5em; left: -1.5px; font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif; font-size: 11px; font-weight: 600; line-height: normal; color: #FFFFFF; background: currentColor; padding: 2px 6px; border-radius: 4px 4px 4px 0; white-space: nowrap; user-select: none; pointer-events: none; z-index: 30; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
        .tiptap .collaboration-carets__selection { opacity: 0.25; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
        .typing-fade { animation: fadeIn 0.2s ease-out; }
      `}</style>

      <div className="flex-1 flex flex-col transition-all duration-300">
        <header
          className={`sticky top-0 z-40 transition-all duration-200 ${scrolled ? 'border-b backdrop-blur-md' : 'border-b border-transparent'}`}
          style={{ backgroundColor: scrolled ? 'rgba(250,248,243,0.92)' : 'rgba(250,248,243,0.6)', borderColor: scrolled ? HAIRLINE : 'transparent' }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Link
                  href="/dashboard"
                  className="flex shrink-0 items-center gap-1 rounded-[5px] px-1.5 py-1 text-[13px] font-medium transition-colors hover:bg-ink/5"
                  style={{ color: TAUPE }}
                >
                  <ArrowLeft size={14} strokeWidth={2.25} />
                  Documents
                </Link>
                <span className="shrink-0 text-[13px]" style={{ color: HAIRLINE }}>/</span>

                <button
                  type="button"
                  onClick={startTitleEdit}
                  title={canRename ? 'Click to rename' : undefined}
                  disabled={!canRename}
                  className={`min-w-0 truncate rounded-[5px] -mx-1.5 px-1.5 py-0.5 font-serif text-[16px] font-semibold tracking-tight transition-colors ${
                    canRename ? 'cursor-text hover:bg-ink/[0.045]' : 'cursor-default'
                  }`}
                  style={{ color: INK }}
                >
                  {documentMeta?.title || 'Untitled manuscript'}
                </button>

                {titleSaveState !== 'idle' && (
                  <span className="hidden shrink-0 text-[12px] sm:inline" style={{ color: TAUPE }}>
                    {titleSaveState === 'saving' ? 'Saving…' : 'Saved'}
                  </span>
                )}

                {myRole === 'viewer' && (
                  <span className="hidden shrink-0 rounded-[5px] px-2 py-1 text-[12px] font-medium sm:inline" style={{ backgroundColor: HAIRLINE, color: TAUPE }}>
                    Read only
                  </span>
                )}
              </div>

              {/* Desktop controls */}
              <div className="hidden shrink-0 items-center gap-4 sm:flex">
                <CollaboratorAvatars users={activeUsers} />
                <ConnectionStatus label={connectionStatus.label} tone={connectionStatus.tone} spinning={connectionStatus.spinning} />

                <div className="h-4 w-px shrink-0" style={{ backgroundColor: HAIRLINE }} />

                {myRole === 'owner' && (
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:opacity-70"
                    style={{ color: RUST }}
                  >
                    <Share2 size={13} strokeWidth={2.1} />
                    Share
                  </button>
                )}

                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:opacity-70"
                  style={{ color: TAUPE }}
                >
                  <HistoryIcon size={13} strokeWidth={2.1} />
                  History
                </button>
              </div>

              {/* Mobile controls: avatars + status + overflow menu */}
              <div className="relative flex shrink-0 items-center gap-2 sm:hidden">
                <CollaboratorAvatars users={activeUsers} max={2} />
                <button
                  onClick={() => setHeaderMenuOpen((v) => !v)}
                  aria-label="More document actions"
                  aria-expanded={headerMenuOpen}
                  className="rounded-[6px] p-1.5 transition-colors hover:bg-ink/5"
                  style={{ color: TAUPE }}
                >
                  <MoreHorizontal size={17} strokeWidth={2} />
                </button>

                {headerMenuOpen && (
                  <div
                    className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-[9px] border py-1 shadow-lg"
                    style={{ backgroundColor: PAPER_RAISED, borderColor: HAIRLINE }}
                  >
                    <div className="px-3 py-2 text-[11px]" style={{ color: TAUPE }}>
                      <ConnectionStatus label={connectionStatus.label} tone={connectionStatus.tone} spinning={connectionStatus.spinning} />
                    </div>
                    {myRole === 'owner' && (
                      <button
                        onClick={() => { setHeaderMenuOpen(false); setShowShareModal(true); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-ink/5"
                        style={{ color: INK }}
                      >
                        <Share2 size={14} strokeWidth={2} />
                        Share
                      </button>
                    )}
                    <button
                      onClick={() => { setHeaderMenuOpen(false); setShowHistory(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-ink/5"
                      style={{ color: INK }}
                    >
                      <HistoryIcon size={14} strokeWidth={2} />
                      History
                    </button>
                  </div>
                )}
              </div>
            </div>

            {typingLabel && (
              <div className="mt-1 text-right">
                <span className="typing-fade text-[11px] italic" style={{ color: TAUPE }}>
                  {typingLabel}
                </span>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto mt-8 sm:mt-10 w-full max-w-[820px] px-4 sm:px-6 pb-24">
          <div
            className="min-h-[520px] sm:min-h-[760px] md:min-h-[980px] lg:min-h-[1160px] overflow-hidden"
            style={{ backgroundColor: PAPER_RAISED, border: `1px solid ${HAIRLINE}`, borderRadius: '12px', boxShadow: '0 1px 2px rgba(28,27,26,0.04), 0 12px 32px rgba(28,27,26,0.05)' }}
          >
            <div className="px-4 sm:px-10 md:px-16 lg:px-20 pt-12 sm:pt-16 lg:pt-20 pb-16 sm:pb-20">

              <div className="mb-6 flex items-start justify-between gap-4">
                {editingTitle ? (
                  <input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); saveTitle(); }
                      if (e.key === 'Escape') { e.preventDefault(); cancelTitleEdit(); }
                    }}
                    aria-label="Document title"
                    className="w-full min-w-0 flex-1 border-b-2 bg-transparent font-serif text-[28px] sm:text-[34px] lg:text-[42px] font-bold leading-tight tracking-tight outline-none"
                    style={{ color: INK, borderColor: RUST }}
                  />
                ) : (
                  <h1
                    onClick={startTitleEdit}
                    title={canRename ? 'Click to rename' : undefined}
                    className={`min-w-0 rounded-[6px] -mx-2 px-2 py-0.5 font-serif text-[28px] sm:text-[34px] lg:text-[42px] font-bold leading-tight tracking-tight transition-colors ${
                      canRename ? 'cursor-text hover:bg-ink/[0.04]' : ''
                    }`}
                    style={{ color: INK }}
                  >
                    {documentMeta?.title || 'Untitled manuscript'}
                  </h1>
                )}

                {titleSaveState !== 'idle' && (
                  <span className="mt-3 shrink-0 text-[12px]" style={{ color: TAUPE }}>
                    {titleSaveState === 'saving' ? 'Saving…' : 'Saved'}
                  </span>
                )}
              </div>

              {editor && myRole !== 'viewer' && (
                <>
                  <BubbleToolbar editor={editor} />
                  <SlashMenu editor={editor} />
                </>
              )}

              <EditorContent editor={editor} />
            </div>
          </div>
        </main>
      </div>

      <HistoryDrawer
        open={showHistory}
        versions={versions}
        canManage={myRole !== 'viewer'}
        onClose={() => setShowHistory(false)}
        onSaveSnapshot={createSnapshot}
        onRequestRestore={requestRestore}
      />

      <ShareModal
        open={showShareModal}
        email={shareEmail}
        onEmailChange={setShareEmail}
        role={shareRole}
        onRoleChange={setShareRole}
        submitting={sharing}
        onSubmit={handleShare}
        onClose={() => setShowShareModal(false)}
      />

      <RestoreConfirmModal
        open={!!restoreTarget}
        restoring={restoring}
        onCancel={cancelRestore}
        onConfirm={confirmRestore}
      />
    </div>
  );
}