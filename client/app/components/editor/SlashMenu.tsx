import { FloatingMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { Heading1, Heading2, List } from 'lucide-react';

interface SlashMenuProps {
  editor: Editor;
}

const ITEMS = [
  {
    key: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    run: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    key: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: 'bullet',
    label: 'Bullet list',
    description: 'Create a simple list',
    icon: List,
    run: (e: Editor) => e.chain().focus().toggleBulletList().run(),
  },
];

export default function SlashMenu({ editor }: SlashMenuProps) {
  return (
    <FloatingMenu
      editor={editor}
      options={{ offset: 10, placement: 'right-start' }}
      className="flex w-56 flex-col gap-0.5 rounded-[10px] border border-hairline bg-paper-raised p-1.5 shadow-lg"
    >
      {ITEMS.map(({ key, label, description, icon: Icon, run }) => (
        <button
          key={key}
          onClick={() => run(editor)}
          className="flex items-center gap-3 rounded-[7px] px-2.5 py-2 text-left transition-colors hover:bg-paper"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-paper text-taupe">
            <Icon size={15} strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">{label}</span>
            <span className="block truncate text-[11px] text-taupe">{description}</span>
          </span>
        </button>
      ))}
    </FloatingMenu>
  );
}
