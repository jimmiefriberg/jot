import { useState } from 'react';

export const CHILDREN_PAGE_SIZE = 500;

/** Number of children to render for a large container, plus a function that reveals the next page. */
export function useVisibleChildCount(total: number) {
  const [visibleCount, setVisibleCount] = useState(CHILDREN_PAGE_SIZE);

  function showMore() {
    setVisibleCount((count) => count + CHILDREN_PAGE_SIZE);
  }

  return { visibleCount: Math.min(visibleCount, total), hiddenCount: Math.max(total - visibleCount, 0), showMore };
}

interface ShowMoreChildrenProps {
  hiddenCount: number;
  onShowMore: () => void;
}

export function ShowMoreChildren({ hiddenCount, onShowMore }: ShowMoreChildrenProps) {
  if (hiddenCount === 0) return null;
  return (
    <button className="show-more-button" onClick={onShowMore}>
      Show {Math.min(hiddenCount, CHILDREN_PAGE_SIZE)} more of {hiddenCount}
    </button>
  );
}
