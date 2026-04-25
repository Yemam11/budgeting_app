import type { Category } from '../types';

interface Props {
  category: Category | undefined;
}

export function CategoryBadge({ category }: Props) {
  if (!category) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600">
        Uncategorized
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: category.color + '22', color: category.color }}
    >
      <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
      {category.name}
    </span>
  );
}
