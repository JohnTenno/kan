import { useEffect } from "react";

import { useModal } from "~/providers/modal";
import CardView, { CardRightPanel } from "~/views/card";

interface Props {
  cardPublicId: string;
  isTemplate?: boolean;
  onClose: () => void;
}

/**
 * Shows a card on top of its board, Trello-style, instead of navigating to
 * the full card page. A plain overlay rather than a headless-ui Dialog: the
 * card's own pickers and editor render popovers outside the panel, and a
 * Dialog would treat clicks on them as "outside" and close the card.
 */
export default function CardDialog({ cardPublicId, isTemplate, onClose }: Props) {
  const { isOpen: isNestedModalOpen } = useModal();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape belongs to an open confirmation modal or dropdown first.
      if (e.key !== "Escape" || e.defaultPrevented || isNestedModalOpen) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, isNestedModalOpen]);

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-dark-50/60 p-2 backdrop-blur-[2px] md:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex w-full max-w-[1100px] flex-col overflow-hidden rounded-lg border border-light-300 bg-light-50 shadow-3xl-light dark:border-dark-300 dark:bg-dark-50 dark:shadow-3xl-dark md:h-[88vh] md:flex-row">
        <div className="flex min-h-[60vh] min-w-0 flex-1 flex-col md:min-h-0">
          <CardView
            isTemplate={isTemplate}
            cardPublicId={cardPublicId}
            onClose={onClose}
          />
        </div>
        <div className="md:h-full md:overflow-y-auto [&>div]:w-full md:[&>div]:w-[360px]">
          <CardRightPanel isTemplate={isTemplate} cardPublicId={cardPublicId} />
        </div>
      </div>
    </div>
  );
}
