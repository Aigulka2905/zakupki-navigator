/** Пометка «похожие»: товар не совпал с запросом по словам — в минимум не идёт, пока его не выберут. */
export function SimilarBadge() {
  return (
    <span className="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-normal text-amber-700 dark:text-amber-400">похожие</span>
  );
}
