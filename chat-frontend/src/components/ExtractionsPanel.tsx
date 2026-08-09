'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { getExtractions } from '@/lib/api';
import { ExtractDataType, ExtractItem } from '@/types/chat';

const DATA_TYPE_LABELS: Record<ExtractDataType, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  bank_account_au: 'Bank Account (AU)',
  bank_account_uk: 'Bank Account (UK)',
  pay_id: 'PayID',
};

function probabilityColorClass(scamProbability: number): string {
  if (scamProbability >= 0.67) {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400';
  }
  if (scamProbability >= 0.34) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400';
}

export default function ExtractionsPanel({
  conversationId,
  scamProbability,
}: {
  conversationId: string;
  scamProbability: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<ExtractItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collapse and drop cached results whenever the viewed conversation changes.
  useEffect(() => {
    setIsOpen(false);
    setItems(null);
    setError(null);
  }, [conversationId]);

  function handleToggle() {
    const next = !isOpen;
    setIsOpen(next);
    if (next && items === null && !loading) {
      setLoading(true);
      setError(null);
      getExtractions(conversationId)
        .then((data) => setItems(data.items))
        .catch((err) =>
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load extracted data.',
          ),
        )
        .finally(() => setLoading(false));
    }
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-l border-zinc-200 bg-zinc-50 transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-950 ${
        isOpen ? 'w-72' : 'w-12'
      }`}
    >
      <div className="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <button
          onClick={handleToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label={
            isOpen ? 'Collapse extracted data' : 'Expand extracted data'
          }
        >
          {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        {isOpen && (
          <span className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <ShieldCheck size={15} />
            Extracted Data
          </span>
        )}
      </div>

      {isOpen && (
        <div className="flex-1 overflow-y-auto p-3">
          <div
            className={`mb-3 rounded-md border p-2 ${probabilityColorClass(scamProbability)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
              Scam Probability
            </p>
            <p className="text-lg font-semibold">
              {Math.round(scamProbability * 100)}%
            </p>
          </div>

          {loading && (
            <p className="text-sm text-zinc-400 dark:text-zinc-600">Loading…</p>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {!loading && !error && items?.length === 0 && (
            <p className="text-sm text-zinc-400 dark:text-zinc-600">
              No data extracted yet.
            </p>
          )}
          {!loading && !error && items && items.length > 0 && (
            <ul className="space-y-3">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
                    {DATA_TYPE_LABELS[item.dataType] ?? item.dataType}
                  </p>
                  <p className="break-all text-sm text-zinc-700 dark:text-zinc-300">
                    {item.value}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
