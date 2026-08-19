// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createManagedWallet } from "@/lib/security/portfolio";
import { WalletPicker } from "./WalletPicker";

describe("WalletPicker", () => {
  afterEach(() => cleanup());

  it("renders a dark controlled listbox rather than a browser-native select and identifies the active wallet", () => {
    const signer = createManagedWallet("0x1111111111111111111111111111111111111111", "Treasury", "connected", 1);
    const watcher = createManagedWallet("0x2222222222222222222222222222222222222222", "Research", "watch", 2);
    const { container } = render(React.createElement(WalletPicker, { activeWallet: signer, wallets: [signer, watcher], onSelect: () => undefined, initiallyOpen: true }));
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("select")).toBeNull();
    expect(screen.getByText("Treasury")).toBeTruthy();
    expect(screen.getByText("Research")).toBeTruthy();
  });

  it("opens the menu and sends the chosen wallet id to the supplied selection handler", async () => {
    const signer = createManagedWallet("0x1111111111111111111111111111111111111111", "Treasury", "connected", 1);
    const watcher = createManagedWallet("0x2222222222222222222222222222222222222222", "Research", "watch", 2);
    const onSelect = vi.fn(); const user = userEvent.setup();
    render(React.createElement(WalletPicker, { activeWallet: signer, wallets: [signer, watcher], onSelect }));
    await user.click(screen.getByRole("button", { name: /Treasury/ }));
    await user.click(screen.getByRole("option", { name: /Research/ }));
    expect(onSelect).toHaveBeenCalledWith(watcher.id);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
