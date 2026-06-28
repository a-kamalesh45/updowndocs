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

const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
const names = ['Kamalesh', 'Rahul', 'Priya', 'Amit', 'Neha', 'Vikram'];

const localUser = {
  name: names[Math.floor(Math.random() * names.length)],
  color: colors[Math.floor(Math.random() * colors.length)],
};

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
        user: localUser,
      }),
      Placeholder.configure({
        placeholder: "Press '/' for commands or start typing...",
        emptyNodeClass: 'before:content-[attr(data-placeholder)] before:text-gray-300 before:float-left before:pointer-events-none before:h-0'
      })
    ],
    editorProps: {
      attributes: {
        // Institutional-grade typography classes
        class: 'prose prose-slate prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-blue-600 max-w-none focus:outline-none min-h-[700px] text-gray-800 leading-relaxed font-sans text-base',
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
  });

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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/auth');

    const socket = io(API_URL, { auth: { token } });

    socket.on('connect', () => setSyncStatus('saved'));
    socket.on('disconnect', () => setSyncStatus('offline'));

    awareness.setLocalState({ user: localUser, typing: false });

    ydoc.on('update', (update) => {
      socket.emit('yjs-update', { documentId, update });
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(saveDocumentContent, 1200);
    });

    socket.on('yjs-update', (update) => Y.applyUpdate(ydoc, new Uint8Array(update)));

    awareness.on('update', (changes: any) => {
      const update = encodeAwarenessUpdate(awareness, changes.added.concat(changes.updated, changes.removed));
      socket.emit('awareness-update', { documentId, update: Array.from(update) });
    });

    socket.on('awareness-update', (update) => applyAwarenessUpdate(awareness, new Uint8Array(update), socket));

    awareness.on('change', () => {
      setActiveUsers(Array.from(awareness.getStates().values()));
    });

    fetch(`${API_URL}/documents/${documentId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setDocumentMeta({ title: data.title });
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
    <div className="h-screen w-full flex items-center justify-center bg-[#FAFAFA]">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
      </div>
    </div>
  );

  const typingUsers = activeUsers.filter(s => s.typing && s.user?.name !== localUser.name);

  return (
    <div className="min-h-screen bg-[#FAFAFA] selection:bg-blue-100 selection:text-blue-900 pb-32">

      {/* Sticky Glassmorphic Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200/80">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">

          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-900 transition flex items-center gap-1 text-sm font-medium">
              ←
            </Link>
            <div className="h-4 w-[1px] bg-gray-300"></div>
            <h1 className="text-sm font-semibold tracking-tight text-gray-900 truncate max-w-[200px]">
              {documentMeta?.title || 'Untitled'}
            </h1>

            {/* Sync Indicator */}
            <div className="flex items-center gap-1.5 ml-2">
              <div className={`h-1.5 w-1.5 rounded-full ${syncStatus === 'saved' ? 'bg-green-500' : syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                {syncStatus}
              </span>
            </div>
          </div>

          {/* Premium Presence Stack */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2 overflow-hidden">
              {activeUsers.map((state, index) => {
                if (!state.user) return null;
                const isMe = state.user.name === localUser.name;
                return (
                  <div
                    key={index}
                    className={`h-7 w-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm transition-transform hover:-translate-y-1 hover:z-10 cursor-default ${isMe ? 'opacity-80' : ''}`}
                    style={{ backgroundColor: state.user.color }}
                    title={`${state.user.name} ${isMe ? '(You)' : ''}`}
                  >
                    {state.user.name.charAt(0)}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Subtle typing indicator bar */}
        <div className="absolute -bottom-6 right-4 text-[10px] font-medium text-gray-500 animate-fade-in h-4">
          {typingUsers.length > 0 && `${typingUsers.map(u => u.user.name).join(', ')} is typing...`}
        </div>
      </header>

      {/* Editor Canvas (Notion/Docs Style) */}
      <main className="max-w-4xl mx-auto mt-8 px-4 sm:px-6">
        <div className="bg-white border border-gray-200/60 rounded-xl shadow-sm min-h-[850px] overflow-hidden">

          {/* Document Content Area */}
          <div className="py-16 px-12 sm:px-24">

            {/* Contextual Floating Menus */}
            {editor && (
              <>
                <BubbleMenu editor={editor} options={{ offset: 8, placement: 'top' }} className="flex overflow-hidden bg-gray-900 text-white rounded-lg shadow-xl shadow-gray-900/10 border border-gray-800 z-50">
                  <button onClick={() => editor.chain().focus().toggleBold().run()} className={`px-3 py-1.5 text-xs font-medium hover:bg-gray-800 transition ${editor.isActive('bold') ? 'bg-gray-800 text-blue-400' : ''}`}>Bold</button>
                  <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-3 py-1.5 text-xs font-medium hover:bg-gray-800 border-l border-gray-700 transition ${editor.isActive('italic') ? 'bg-gray-800 text-blue-400' : ''}`}>Italic</button>
                  <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`px-3 py-1.5 text-xs font-medium hover:bg-gray-800 border-l border-gray-700 transition ${editor.isActive('strike') ? 'bg-gray-800 text-blue-400' : ''}`}>Strike</button>
                  <button onClick={() => editor.chain().focus().toggleCode().run()} className={`px-3 py-1.5 text-xs font-medium hover:bg-gray-800 border-l border-gray-700 transition ${editor.isActive('code') ? 'bg-gray-800 text-blue-400' : ''}`}>{'<>'}</button>
                </BubbleMenu>

                <FloatingMenu editor={editor} options={{ offset: 8, placement: 'right-start' }} className="flex flex-col gap-1 bg-white border border-gray-200 p-1.5 rounded-lg shadow-lg shadow-gray-200/50 z-50">
                  <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className="px-3 py-1.5 text-xs font-medium text-gray-700 text-left hover:bg-gray-50 rounded transition">Heading 1</button>
                  <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="px-3 py-1.5 text-xs font-medium text-gray-700 text-left hover:bg-gray-50 rounded transition">Heading 2</button>
                  <button onClick={() => editor.chain().focus().toggleBulletList().run()} className="px-3 py-1.5 text-xs font-medium text-gray-700 text-left hover:bg-gray-50 rounded transition">Bullet List</button>
                </FloatingMenu>
              </>
            )}

            <EditorContent editor={editor} />
          </div>
        </div>
      </main>
    </div>
  );
}