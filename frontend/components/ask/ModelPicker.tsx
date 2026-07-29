"use client";

import { useCallback, useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { Modal } from "@/components/ui/Modal";
import { listModels, type ApiProvider, type ApiProviderId } from "@/lib/api";
import { cn } from "@/lib/cn";

/**
 * Which model answers the next question.
 *
 * `local` is our own fine-tuned model, served by Ollama on the user's machine.
 * It is genuinely unreachable from the hosted API — a server cannot see a
 * laptop — so this control states that rather than hiding the option. The
 * long explanation lives behind the ⓘ so the menu itself stays compact.
 *
 * Status is re-fetched every time the menu opens: Ollama can stop at any
 * moment and a stale green dot is worse than no dot.
 */
export function ModelPicker({
  token,
  value,
  onChange,
  disabled,
}: {
  token: string | null;
  value: ApiProviderId | null;
  onChange: (id: ApiProviderId) => void;
  disabled?: boolean;
}) {
  const [models, setModels] = useState<ApiProvider[]>([]);
  const [explain, setExplain] = useState<ApiProvider | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setModels(await listModels(token));
    } catch {
      setModels([]); // degrade to "unknown", never to a crash
    }
  }, [token]);

  // Fetch once on mount so the trigger's dot means something before anyone
  // opens the menu. setState lands after the await — never synchronously in
  // the effect body, which would cascade renders.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listModels(token);
        if (!cancelled) setModels(rows);
      } catch {
        if (!cancelled) setModels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const current = models.find((m) => m.id === value) ?? null;
  const label = current?.label ?? (value === "local" ? "brainstack-3b" : "Claude");

  return (
    <>
      <Dropdown
        align="right"
        className="shrink-0"
        trigger={
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs",
              disabled ? "cursor-not-allowed opacity-60" : "hover:bg-surface-raised",
            )}
            onClick={() => {
              if (!disabled) void refresh();
            }}
          >
            <Dot state={current ? (current.available ? "on" : "off") : "unknown"} />
            <span className="max-w-32 truncate font-medium">{label}</span>
            <svg viewBox="0 0 20 20" className="h-3 w-3 text-subtle" aria-hidden>
              <path
                d="M6 8l4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
        }
      >
        <div className="w-56">
          {models.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted">Checking models…</p>
          )}

          {models.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-1.5 py-1.5",
                m.id === value && "bg-surface-raised",
              )}
            >
              <button
                type="button"
                role="menuitemradio"
                aria-checked={m.id === value}
                disabled={!m.available}
                onClick={() => m.available && onChange(m.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 text-left",
                  !m.available && "cursor-not-allowed",
                )}
              >
                <Dot state={m.available ? "on" : "off"} />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-xs font-medium",
                    m.available ? "text-primary" : "text-muted",
                  )}
                >
                  {m.label}
                </span>
              </button>
              {/* Deliberately lets the click bubble: the Dropdown panel closes
                  on any click inside it, and the Modal is a SIBLING of the
                  Dropdown, so it survives. Menu closes, modal opens. */}
              <button
                type="button"
                aria-label={`Why is ${m.label} ${m.available ? "available" : "unavailable"}?`}
                onClick={() => setExplain(m)}
                className="shrink-0 rounded p-0.5 text-subtle hover:text-primary"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Dropdown>

      <Modal
        open={explain !== null}
        onClose={() => setExplain(null)}
        title={explain?.title ?? ""}
      >
        {explain && (
          <div className="space-y-3 text-sm">
            <p className="font-mono text-xs text-subtle">{explain.label}</p>
            <p className="flex items-center gap-2">
              <Dot state={explain.available ? "on" : "off"} />
              <span className={explain.available ? "text-success" : "text-danger"}>
                {explain.detail}
              </span>
            </p>
            <p className="leading-relaxed text-muted">{explain.note}</p>
            {!explain.available && explain.kind === "local" && (
              <div className="rounded-lg border border-border bg-surface-raised p-3">
                <p className="mb-2 text-xs font-medium text-primary">
                  To use it, run BrainStack on your own machine:
                </p>
                <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-muted">
                  {`ollama serve\nollama run ${explain.label}\n\n# then, in the repo\nLLM_PROVIDER=local  # .env\npython -m uvicorn app.main:app --port 8000`}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function Dot({ state }: { state: "on" | "off" | "unknown" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        state === "on" && "bg-success",
        state === "off" && "bg-danger",
        state === "unknown" && "bg-border",
      )}
    />
  );
}
