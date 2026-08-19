import { useState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import type { ManagedWallet } from "@/lib/security/types";

interface ScanFormProps {
  activeWallet: ManagedWallet | undefined;
  activeAddress: string | undefined;
  isInspecting: boolean;
  onInspect: (draft: { to: string; value: string; data: string; declaredAction: string }, intentKind: string) => void;
  initialDraft: { to: string; value: string; data: string; declaredAction: string };
  initialIntent: string;
}

export function ScanForm({ activeWallet, activeAddress, isInspecting, onInspect, initialDraft, initialIntent }: ScanFormProps) {
  const [intentKind, setIntentKind] = useState(initialIntent);
  const [liveDraft, setLiveDraft] = useState(initialDraft);

  return (
    <>
      <div className="intent-picker">
        <span>What do you intend to do?</span>
        <div>
          {["Send tokens", "Approve tokens", "Swap", "Contract call"].map(
            option => (
              <button
                key={option}
                className={intentKind === option ? "active" : ""}
                onClick={() => setIntentKind(option)}
              >
                {option}
              </button>
            )
          )}
        </div>
      </div>
      <div className="night-fields">
        <label>
          Destination
          <input
            value={liveDraft.to}
            onChange={event =>
              setLiveDraft(draft => ({
                ...draft,
                to: event.target.value,
              }))
            }
            placeholder="0x… contract or recipient"
          />
        </label>
        <label>
          Value / OKB
          <input
            value={liveDraft.value}
            onChange={event =>
              setLiveDraft(draft => ({
                ...draft,
                value: event.target.value,
              }))
            }
            inputMode="decimal"
          />
        </label>
        <label className="wide">
          Calldata
          <textarea
            value={liveDraft.data}
            onChange={event =>
              setLiveDraft(draft => ({
                ...draft,
                data: event.target.value,
              }))
            }
            placeholder="0x or encoded calldata"
          />
        </label>
        <label className="wide">
          Claimed intent <small>optional detail</small>
          <input
            value={liveDraft.declaredAction}
            onChange={event =>
              setLiveDraft(draft => ({
                ...draft,
                declaredAction: event.target.value,
              }))
            }
            placeholder={`Example: ${intentKind.toLowerCase()}`}
          />
        </label>
      </div>
      <footer>
        <span>
          <LockKeyhole size={14} />{" "}
          {activeWallet?.kind === "watch"
            ? "Watch wallets never sign."
            : "Guardian never signs."}
        </span>
        <button
          onClick={() => onInspect(liveDraft, intentKind)}
          disabled={!activeAddress || isInspecting}
        >
          {isInspecting ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            "Review request"
          )}
          <ArrowRight size={15} />
        </button>
      </footer>
    </>
  );
}
