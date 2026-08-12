import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Strikethrough, Code } from 'lucide-react';

interface BubbleToolbarProps {
  editor: Editor;
}

const ACTIONS = [
  { key: 'bold', label: 'Bold', icon: Bold, run: (e: Editor) => e.chain().focus().toggleBold().run(), active: (e: Editor) => e.isActive('bold') },
  { key: 'italic', label: 'Italic', icon: Italic, run: (e: Editor) => e.chain().focus().toggleItalic().run(), active: (e: Editor) => e.isActive('italic') },
  { key: 'strike', label: 'Strikethrough', icon: Strikethrough, run: (e: Editor) => e.chain().focus().toggleStrike().run(), active: (e: Editor) => e.isActive('strike') },
  { key: 'code', label: 'Code', icon: Code, run: (e: Editor) => e.chain().focus().toggleCode().run(), active: (e: Editor) => e.isActive('code') },
];

export default function BubbleToolbar({ editor }: BubbleToolbarProps) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ offset: 10, placement: 'top' }}
      className="flex items-center gap-0.5 rounded-[9px] border border-hairline bg-paper-raised p-1 shadow-lg"
    >
      {ACTIONS.map(({ key, label, icon: Icon, run, active }) => {
        const isActive = active(editor);
        return (
          <button
            key={key}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => run(editor)}
            className={`flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors ${
              isActive ? 'bg-rust/10 text-rust' : 'text-ink hover:bg-paper'
            }`}
          >
            <Icon size={14} strokeWidth={2.1} />
          </button>
        );
      })}
    </BubbleMenu>
  );
}
