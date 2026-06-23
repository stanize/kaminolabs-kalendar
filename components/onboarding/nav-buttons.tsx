import { Btn } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function NavBtns({
  paso,
  canNext,
  next,
  back,
  loading,
  errorMsg,
}: {
  paso: number;
  canNext: boolean;
  next: () => void;
  back: () => void;
  loading?: boolean;
  errorMsg?: string | null;
}) {
  // Step 0 is Google-only — no Continuar button needed
  if (paso === 0) return null;

  return (
    <div className="mt-[26px] border-t border-line pt-[22px]">
      {errorMsg && (
        <p className="mb-3 rounded-[10px] bg-error-weak px-3.5 py-2.5 text-[13.5px] font-medium text-error">
          {errorMsg}
        </p>
      )}
      <div className="flex items-center justify-between">
        {paso > 0 ? (
          <Btn variant="ghost" onClick={back} disabled={loading}>
            <Icon name="chevronLeft" size={17} /> Atrás
          </Btn>
        ) : (
          <span />
        )}
        <Btn onClick={next} disabled={!canNext || loading}>
          {loading ? "Creando…" : paso === 4 ? "Crear mi página" : "Continuar"}
          {!loading && <Icon name="arrowRight" size={17} />}
        </Btn>
      </div>
    </div>
  );
}
