import { useRef, useState } from 'react';
import { Icon } from './Primitives';

interface Props {
  onFiles: (files: File[]) => void;
  accept?: string;
  busy?: boolean;
}

export function DropZone({ onFiles, accept = '.csv,.xls,.xlsx', busy = false }: Props) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  function handleFiles(files: File[]) {
    if (files.length && !busy) onFiles(files);
  }

  return (
    <div
      className="glass"
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(Array.from(e.dataTransfer.files)); }}
      style={{
        padding: 36,
        textAlign: 'center',
        border: drag
          ? '1.5px dashed var(--accent)'
          : '1.5px dashed color-mix(in oklab, var(--accent), transparent 50%)',
        background: drag
          ? 'color-mix(in oklab, var(--accent-soft), white 30%)'
          : 'color-mix(in oklab, var(--accent-soft), white 50%)',
        transition: 'border-color .15s, background .15s',
        cursor: busy ? 'default' : 'pointer',
      }}
      onClick={() => !busy && ref.current?.click()}
    >
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent), transparent 60%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-ink)', marginBottom: 14 }}>
        <Icon name="upload" size={22} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
        {busy ? 'Parsing…' : 'Drop CSV files anywhere'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 16 }}>
        Supports Amex, BMO, Scotiabank, and Simplii exports · up to 20 files
      </div>
      {!busy && (
        <button
          className="btn btn-primary"
          onClick={(e) => { e.stopPropagation(); ref.current?.click(); }}
        >
          Choose files
        </button>
      )}
      <input
        ref={ref}
        type="file"
        multiple
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []));
          if (ref.current) ref.current.value = '';
        }}
      />
    </div>
  );
}
