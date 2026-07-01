'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import { io } from 'socket.io-client';

const INK = '#1C1B1A';
const PAPER = '#FAF8F3';
const PAPER_RAISED = '#FFFFFF';
const RUST = '#C4502A';
const TAUPE = '#8A8578';
const HAIRLINE = '#E3DDD0';

export default function DocumentPage() {
  const params = useParams();
  const documentId = params.id as string;
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.10:4000';

  const ydoc = useMemo(() => new Y.Doc(), []);
  const awareness = useMemo(() => new Awareness(ydoc), [ydoc]);

  const [documentMeta, setDocumentMeta] = useState<{ title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'syncing' | 'offline'>('syncing');

  const [localUser, setLocalUser] = useState({ name: 'Connecting...', color: TAUPE });

  // STAGE 7: Version History State
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

  // STAGE 8: Sharing & Role State
  const [myRole, setMyRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'editor' | 'viewer'>('viewer');

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
        placeholder: "Press '/' for commands or start typing...",
        emptyNodeClass: 'before:content-[attr(data-placeholder)] before:text-[#C2BCAE] before:float-left before:pointer-events-none before:h-0'
      })
    ],
    editorProps: {
      attributes: {
        class: 'manuscript-prose max-w-none focus:outline-none min-h-[700px]',
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

  const saveDocumentContent = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const state = Y.encodeStateAsUpdate(ydoc);
    try {
      await fetch(`${API_URL}/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { update: Array.from(state) } })
      });
      setSyncStatus('saved');
    } catch (err) {
      console.error('Save failed:', err);
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
    if (!confirm('Are you sure? This replaces the document for all active collaborators.')) return;
    const token = localStorage.getItem('token');
    try {
      await createSnapshot();
      const res = await fetch(`${API_URL}/documents/${documentId}/versions/${versionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      editor?.commands.setContent(data.content);
      setShowHistory(false);
    } catch (err) { console.error('Failed to restore version', err); }
  };

  // STAGE 8: Handle Share Submission
  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/documents/${documentId}/share`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail, role: shareRole })
      });
      
      if (res.ok) {
        alert('User invited successfully!');
        setShowShareModal(false);
        setShareEmail('');
      } else {
        const errData = await res.json();
        alert(`Failed to share: ${errData.error}`);
      }
    } catch (err) {
      console.error('Share error', err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/auth');

    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.userId;

    const userColors = ['#C4502A', '#2F5233', '#1D4E89', '#7A4B8A', '#A6762E', '#3A6E6E'];
    const colorIndex = Array.from(userId).reduce((acc: number, char: any) => acc + char.charCodeAt(0), 0) % userColors.length;
    const myColor = userColors[colorIndex];

    let persistentUser = { name: `User ${userId.substring(0, 4)}`, color: myColor };
    setLocalUser(persistentUser);
    awareness.setLocalState({ user: persistentUser, typing: false });

    fetch(`${API_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(({ user }) => {
        persistentUser = { name: user.name, color: myColor };
        setLocalUser(persistentUser);
        awareness.setLocalState({ user: persistentUser, typing: false });
      })
      .catch(() => {});

    const socket = io(API_URL, { auth: { token } });

    socket.on('connect', () => setSyncStatus('saved'));
    socket.on('disconnect', () => setSyncStatus('offline'));

    socket.on('auth-expired', () => {
      localStorage.removeItem('token');
      router.push('/auth');
    });

    ydoc.on('update', (update) => {
      socket.emit('yjs-update', { documentId, update });

      if (!saveTimeoutRef.current) {
        saveTimeoutRef.current = setTimeout(() => {
          saveDocumentContent();
          saveTimeoutRef.current = null;
        }, 5000);
      }
    });

    fetchVersions();

    socket.on('yjs-update', (update) => Y.applyUpdate(ydoc, new Uint8Array(update)));

    awareness.on('update', (changes: any, origin: any) => {
      if (origin === socket) return; 
      const update = encodeAwarenessUpdate(awareness, changes.added.concat(changes.updated, changes.removed));
      socket.emit('awareness-update', { documentId, update: Array.from(update) });
    });

    socket.on('awareness-update', (update) => applyAwarenessUpdate(awareness, new Uint8Array(update), socket));

    awareness.on('change', () => {
      const entries = Array.from(awareness.getStates().entries());
      const validUsers = entries.filter(([, s]: any) => s.user && s.user.name);
      setActiveUsers(validUsers);
    });

    fetch(`${API_URL}/documents/${documentId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setDocumentMeta({ title: data.title });
        setMyRole(data.myRole); // STAGE 8: Save role from backend
        if (data.content?.update) Y.applyUpdate(ydoc, new Uint8Array(data.content.update));
        setLoading(false);
        setSyncStatus('saved');
      })
      .catch(() => router.push('/dashboard'));

    socket.emit('join-document', documentId);

    return () => {
      socket.disconnect();
      ydoc.destroy();
      awareness.destroy();
    };
  }, [ydoc, awareness, documentId, router, API_URL]);

  if (loading || !editor) return (
    <div className="h-screen w-full flex items-center justify-center" style={{ backgroundColor: PAPER }}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: HAIRLINE, borderTopColor: RUST }}></div>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: TAUPE }}>Opening manuscript</span>
      </div>
    </div>
  );

  const typingUsers = activeUsers.filter(([, s]: any) => s.typing && s.user?.name !== localUser.name);

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
        .tiptap .collaboration-carets__label { position: absolute; top: -1.5em; left: -1.5px; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; font-weight: 600; line-height: normal; color: #FFFFFF; background: currentColor; padding: 1px 5px; border-radius: 3px 3px 3px 0; white-space: nowrap; user-select: none; pointer-events: none; z-index: 30; }
        .tiptap .collaboration-carets__selection { opacity: 0.25; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
        .typing-fade { animation: fadeIn 0.2s ease-out; }
      `}</style>

      <div className="flex-1 flex flex-col transition-all duration-300">
        <header className="sticky top-0 z-40" style={{ backgroundColor: 'rgba(250,248,243,0.92)', backdropFilter: 'blur(6px)' }}>
          <div className="max-w-5xl mx-auto px-6 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Link href="/dashboard" className="font-mono text-[11px] uppercase tracking-[0.15em] shrink-0 transition-colors" style={{ color: TAUPE }}>
                  ← Index
                </Link>
                <span className="shrink-0" style={{ color: HAIRLINE }}>/</span>
                <h1 className="truncate font-serif text-[15px] font-semibold tracking-tight" style={{ color: INK }}>
                  {documentMeta?.title || 'Untitled manuscript'}
                </h1>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {/* STAGE 8: Read-Only Badge */}
                {myRole === 'viewer' && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded" style={{ backgroundColor: HAIRLINE, color: TAUPE }}>
                    Read-Only
                  </span>
                )}

                {/* STAGE 8: Share Button (Owner Only) */}
                {myRole === 'owner' && (
                  <button onClick={() => setShowShareModal(true)} className="font-mono text-[10px] uppercase tracking-[0.15em] transition-colors hover:opacity-70" style={{ color: RUST }}>
                    Share
                  </button>
                )}

                <button onClick={() => setShowHistory(true)} className="font-mono text-[10px] uppercase tracking-[0.15em] transition-colors hover:opacity-70" style={{ color: TAUPE }}>
                  History
                </button>

                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <div className="flex items-center -space-x-2.5">
                    {activeUsers.map(([clientId, state]: any, i: number) => (
                      <div key={clientId} title={state.user.name} className="h-7 w-7 flex items-center justify-center font-mono text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: PAPER_RAISED, color: state.user.color, border: `1.5px solid ${state.user.color}`, borderRadius: '3px', transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (4 + (i % 3))}deg)`, boxShadow: '1px 1px 0 rgba(0,0,0,0.05)' }}>
                        {state.user.name.charAt(0)}
                      </div>
                    ))}
                  </div>

                  <div className="h-4 w-[1px]" style={{ backgroundColor: HAIRLINE }}></div>

                  <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: TAUPE }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: syncStatus === 'saved' ? '#2F5233' : syncStatus === 'syncing' ? RUST : '#A33A3A' }}></span>
                    {syncStatus}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 h-[2px] w-full" style={{ backgroundColor: RUST }}></div>

            <div className="h-4 mt-1 text-right">
              {typingUsers.length > 0 && (
                <span className="typing-fade font-mono text-[10px] italic" style={{ color: TAUPE }}>
                  {typingUsers.map(([, s]: any) => s.user.name).join(', ')} writing…
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto mt-6 w-full px-4 sm:px-6">
          <div className="overflow-hidden" style={{ backgroundColor: PAPER_RAISED, border: `1px solid ${HAIRLINE}`, borderRadius: '2px', boxShadow: '0 1px 2px rgba(28,27,26,0.04), 0 8px 24px rgba(28,27,26,0.04)' }}>
            <div className="py-14 px-10 sm:px-20">
              
              {/* STAGE 8: Hide floating menus from viewers */}
              {editor && myRole !== 'viewer' && (
                <>
                  <BubbleMenu editor={editor} options={{ offset: 8, placement: 'top' }} className="flex overflow-hidden z-50" style={{ backgroundColor: INK, borderRadius: '4px', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
                    {[
                      { label: 'B', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
                      { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
                      { label: 'S', action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
                      { label: '<>', action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
                    ].map((btn, i) => (
                      <button key={btn.label} onClick={btn.action} className="px-3 py-2 font-mono text-[11px] transition-colors" style={{ color: btn.active ? RUST : '#E8E2D6', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                        {btn.label}
                      </button>
                    ))}
                  </BubbleMenu>

                  <FloatingMenu editor={editor} options={{ offset: 8, placement: 'right-start' }} className="flex flex-col gap-0.5 p-1 z-50" style={{ backgroundColor: PAPER_RAISED, border: `1px solid ${HAIRLINE}`, borderRadius: '4px', boxShadow: '0 4px 14px rgba(28,27,26,0.08)' }}>
                    {[
                      { label: 'Heading 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
                      { label: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
                      { label: 'Bullet list', action: () => editor.chain().focus().toggleBulletList().run() },
                    ].map((item) => (
                      <button key={item.label} onClick={item.action} className="px-3 py-1.5 font-mono text-[11px] text-left rounded transition-colors" style={{ color: INK }}>
                        {item.label}
                      </button>
                    ))}
                  </FloatingMenu>
                </>
              )}

              <EditorContent editor={editor} />
            </div>
          </div>
        </main>
      </div>

      {showHistory && (
        <div className="w-80 shadow-2xl flex flex-col absolute right-0 top-0 bottom-0 z-50 animate-fade-in" style={{ backgroundColor: PAPER_RAISED, borderLeft: `1px solid ${HAIRLINE}` }}>
          <div className="p-4 flex justify-between items-center" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            <h2 className="text-sm font-bold" style={{ color: INK }}>Version History</h2>
            <button onClick={() => setShowHistory(false)} style={{ color: TAUPE }}>✕</button>
          </div>
          
          {myRole !== 'viewer' && (
            <div className="p-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <button onClick={createSnapshot} className="w-full text-xs font-bold py-2 rounded shadow-sm transition" style={{ backgroundColor: INK, color: PAPER }}>
                + Save Current Version
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {versions.length === 0 ? (
              <p className="text-xs text-center mt-10" style={{ color: TAUPE }}>No saved versions yet.</p>
            ) : (
              versions.map((v) => (
                <div key={v.id} className="border rounded p-3 transition group relative" style={{ borderColor: HAIRLINE }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: RUST }}>
                    {new Date(v.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs mb-3" style={{ color: INK }}>
                    {new Date(v.created_at).toLocaleTimeString()}
                  </div>
                  <div className="text-[10px] flex justify-between items-center" style={{ color: TAUPE }}>
                    <span>By {v.author_name || 'Owner'}</span>
                    
                    {myRole !== 'viewer' && (
                      <button onClick={() => restoreVersion(v.id)} className="font-bold opacity-0 group-hover:opacity-100 transition" style={{ color: RUST }}>
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* STAGE 8: Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded p-6 shadow-2xl" style={{ backgroundColor: PAPER_RAISED, border: `1px solid ${HAIRLINE}` }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-serif font-semibold text-lg" style={{ color: INK }}>Invite Collaborator</h3>
              <button onClick={() => setShowShareModal(false)} style={{ color: TAUPE }}>✕</button>
            </div>
            
            <form onSubmit={handleShare} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: TAUPE }}>Email Address</label>
                <input 
                  type="email" 
                  required 
                  value={shareEmail} 
                  onChange={e => setShareEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm outline-none focus:ring-1 transition"
                  style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}`, color: INK, outlineColor: RUST }}
                  placeholder="colleague@university.edu"
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: TAUPE }}>Role</label>
                <select 
                  value={shareRole}
                  onChange={e => setShareRole(e.target.value as 'editor' | 'viewer')}
                  className="w-full px-3 py-2 text-sm outline-none focus:ring-1 transition cursor-pointer"
                  style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}`, color: INK, outlineColor: RUST }}
                >
                  <option value="editor">Editor (Can edit text)</option>
                  <option value="viewer">Viewer (Read-only)</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="w-full font-bold text-xs py-2.5 rounded mt-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: INK, color: PAPER }}
              >
                Send Invitation
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}