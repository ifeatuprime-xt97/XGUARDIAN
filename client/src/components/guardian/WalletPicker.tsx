import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ManagedWallet } from "@/lib/security/types";

type Props = {
  activeWallet?: ManagedWallet;
  wallets: ManagedWallet[];
  onSelect: (walletId: string) => void;
  initiallyOpen?: boolean;
};

const compact = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const title = (wallet: ManagedWallet) => wallet.label || compact(wallet.address);

export function WalletPicker({ activeWallet, wallets, onSelect, initiallyOpen = false }: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  return <div className="wallet-switcher"><span>Active wallet</span><button type="button" className="wallet-picker-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><b>{activeWallet ? `${title(activeWallet)} · ${compact(activeWallet.address)}` : "No wallet selected"}</b><ChevronDown size={16} aria-hidden="true" /></button>{open && <div className="wallet-picker-menu" role="listbox" aria-label="Active wallet">{wallets.length ? wallets.map((item) => <button key={item.id} type="button" role="option" aria-selected={item.id === activeWallet?.id} className={item.id === activeWallet?.id ? "active" : ""} onClick={() => { onSelect(item.id); setOpen(false); }}><strong>{title(item)}</strong><small>{compact(item.address)} · {item.kind === "connected" ? "Signer" : "Watch"}</small></button>) : <p>No wallets in this browser. Add or connect one to select it.</p>}</div>}</div>;
}
