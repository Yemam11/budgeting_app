import { useRef, useState } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  accept?: string;
}

export function DropZone({ onFiles, accept = '.csv,.xls,.xlsx' }: Props) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      onClick={() => ref.current?.click()}
      className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition ${
        drag ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white hover:border-slate-400'
      }`}
    >
      <div className="text-slate-600">
        <div className="text-lg font-medium text-slate-800">Drop CSV / XLS here</div>
        <div className="mt-1 text-sm">Amex (.xls), BMO (.csv), Scotia (.csv) — multiple files at once is fine</div>
        <div className="mt-2 text-xs text-slate-500">or click to pick</div>
      </div>
      <input
        ref={ref}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          if (ref.current) ref.current.value = '';
        }}
      />
    </div>
  );
}
