import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useEditorStore } from '@/shared/stores/editorStore';
import { toast } from '@/shared/hooks/use-toast';

interface Props {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<Props> = ({ language, code }) => {
  const applyFix = useEditorStore((s) => s.applyFixToEditor);
  const replaceContent = useEditorStore((s) => s.replaceEditorContent);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    toast({ title: 'Copied' });
  };

  const apply = () => {
    if (!applyFix && !replaceContent) {
      toast({ title: 'Open a file first', variant: 'destructive' });
      return;
    }
    // applyFix expects (line, content); we have no specific line, so insert
    // by replacing the whole document if `replaceContent` is set.
    if (replaceContent) {
      replaceContent(code);
      toast({ title: 'Applied' });
    }
  };

  return (
    <div className="my-2 rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-muted/40 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{language || 'code'}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copy} title="Copy">
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={apply} title="Apply to editor">
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: '8px 12px', fontSize: '12px', background: 'transparent' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};
