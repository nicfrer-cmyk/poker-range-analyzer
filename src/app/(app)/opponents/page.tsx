"use client";

import { useEffect, useState } from "react";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { OpponentCard } from "@/components/opponents/OpponentCard";
import {
  OpponentFormModal,
  type OpponentFormValues,
} from "@/components/opponents/OpponentFormModal";
import {
  listOpponents,
  saveOpponent,
  updateOpponent,
  deleteOpponent,
  type StoredOpponent,
} from "@/lib/localOpponentStore";
import { listHands, updateHand, type StoredHand } from "@/lib/localHandStore";

export default function OpponentsPage() {
  const [opponents, setOpponents] = useState<StoredOpponent[]>([]);
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOpponent, setEditingOpponent] = useState<StoredOpponent | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const refresh = () => {
    setOpponents(listOpponents());
    setHands(listHands());
  };

  useEffect(() => {
    refresh();
  }, []);

  const openCreateModal = () => {
    setEditingOpponent(null);
    setModalOpen(true);
  };

  const openEditModal = (opponent: StoredOpponent) => {
    setEditingOpponent(opponent);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingOpponent(null);
  };

  const handleSubmit = (values: OpponentFormValues) => {
    if (editingOpponent) {
      updateOpponent(editingOpponent.id, values);
    } else {
      saveOpponent(values);
    }
    closeModal();
    refresh();
  };

  const handleDelete = (opponent: StoredOpponent) => {
    const confirmed = window.confirm(
      `למחוק את הפרופיל של "${opponent.name}"? הפעולה אינה הפיכה, אך ידיים שקושרו אליו יישארו בספרייה ללא שיוך.`
    );
    if (!confirmed) return;

    // Free up hands linked to this opponent so they show up again as unlinked.
    hands
      .filter((h) => h.opponentId === opponent.id)
      .forEach((h) => updateHand(h.id, { opponentId: undefined }));

    deleteOpponent(opponent.id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(opponent.id);
      return next;
    });
    refresh();
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const linkHand = (handId: string, opponentId: string) => {
    updateHand(handId, { opponentId });
    refresh();
  };

  const unlinkHand = (handId: string) => {
    updateHand(handId, { opponentId: undefined });
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">פרופילי יריבים</h1>
          <p className="text-sm text-base-muted">
            תיעוד דפוסי משחק של יריבים קבועים — לניתוח ולמידה אחרי המשחק בלבד.
          </p>
        </div>
        <Button onClick={openCreateModal}>פרופיל יריב חדש</Button>
      </div>

      {opponents.length === 0 ? (
        <Panel className="mx-auto max-w-xl text-center">
          <PanelBody className="space-y-4 py-10">
            <h2 className="text-lg font-semibold">עדיין אין פרופילי יריבים</h2>
            <p className="text-sm leading-relaxed text-base-muted">
              שמור פרופילים של יריבים קבועים כדי לזהות דפוסים אחרי המשחק — לא לשימוש בזמן משחק
              חי. סמן לכל יריב אם הוא טייט או לוס, פסיבי או אגרסיבי, הוסף הערות חופשיות, וקשר
              אליו ידיים מהספרייה שלך כדי לבנות תמונה לאורך זמן.
            </p>
            <Button onClick={openCreateModal}>צור פרופיל ראשון</Button>
          </PanelBody>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {opponents.map((opponent) => (
            <OpponentCard
              key={opponent.id}
              opponent={opponent}
              hands={hands}
              expanded={expandedIds.has(opponent.id)}
              onToggleExpand={() => toggleExpand(opponent.id)}
              onEdit={() => openEditModal(opponent)}
              onDelete={() => handleDelete(opponent)}
              onLinkHand={(handId) => linkHand(handId, opponent.id)}
              onUnlinkHand={unlinkHand}
            />
          ))}
        </div>
      )}

      <OpponentFormModal
        open={modalOpen}
        editing={editingOpponent}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
