'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { io } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

export default function DocumentPage() {
  const params = useParams();
  const documentId = params.id as string;
  const router = useRouter();

  const ydoc = useMemo(() => new Y.Doc(), []);

  const [documentMeta, setDocumentMeta] = useState<{
    title: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false,
      }),
      Collaboration.configure({
        document: ydoc,
      }),
    ],
  });

  const saveDocumentContent = async () => {
    const token = localStorage.getItem('token');

    if (!token) return;

    const state = Y.encodeStateAsUpdate(ydoc);

    try {
      await fetch(`${API_URL}/documents/${documentId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            update: Array.from(state),
          },
        }),
      });

      console.log('Document binary state saved');
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      router.push('/auth');
      return;
    }

    const socket = io(API_URL, {
      auth: {
        token,
      },
    });

    ydoc.on('update', (update) => {
      socket.emit('yjs-update', {
        documentId,
        update,
      });

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveDocumentContent();
      }, 1000);
    });

    socket.on('yjs-update', (update) => {
      Y.applyUpdate(
        ydoc,
        new Uint8Array(update)
      );
    });

    fetch(`${API_URL}/documents/${documentId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => {

        setDocumentMeta({
          title: data.title,
        });

        if (
          data.content &&
          data.content.update
        ) {
          Y.applyUpdate(
            ydoc,
            new Uint8Array(
              data.content.update
            )
          );
        }

        setLoading(false);
      })
      .catch(() => {
        router.push('/dashboard');
      });

    socket.emit(
      'join-document',
      documentId
    );

    return () => {
      socket.disconnect();

      if (saveTimeoutRef.current) {
        clearTimeout(
          saveTimeoutRef.current
        );
      }

      ydoc.destroy();
    };

  }, [ydoc, documentId, router]);

  if (loading || !editor) {
    return (
      <div className="p-8 font-mono">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-10 pb-20">

      <div className="w-full max-w-4xl px-8">

        <div className="flex justify-between items-center mb-6">

          <h1 className="text-2xl font-semibold text-gray-900">
            {documentMeta?.title || 'Loading...'}
          </h1>

          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back to Dashboard
          </Link>

        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-sm p-4">

          <div className="border border-transparent hover:border-gray-100 transition rounded-sm">

            <EditorContent editor={editor} />

          </div>

        </div>

      </div>

    </div>
  );
}