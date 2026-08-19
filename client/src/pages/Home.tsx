import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseEther } from "viem";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Eye,
  History,
  Home as HomeIcon,
  LayoutGrid,
  LoaderCircle,
  LockKeyhole,
  Network,
  Plus,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet,
  WalletCards,
} from "lucide-react";
import { AnalysisBoard } from "@/components/guardian/AnalysisBoard";
import { WalletPicker } from "@/components/guardian/WalletPicker";
import { ScanForm } from "@/components/guardian/ScanForm";
import { trpc } from "@/lib/trpc";
import {
  createLiveAssetComparison,
  createVerifiedAssetComparison,
  decodedAssetMovements,
} from "@/lib/security/assetComparison";
import { XLAYER_CONFIG } from "@/lib/security/config";
import { decodeTransaction } from "@/lib/security/decoder";
import { DEMO_SCENARIOS } from "@/lib/security/demo";
import {
  canRequestSignature,
  SCENARIO_ACTIONS,
  type PortfolioSection,
} from "@/lib/security/experience";
import { canOpenWalletConfirmation } from "@/lib/security/presentation";
import {
  activePortfolioWallet,
  createManagedWallet,
  emptyPortfolio,
  loadPortfolio,
  removePortfolioWallet,
  savePortfolio,
  setActivePortfolioWallet,
  upsertPortfolioWallet,
} from "@/lib/security/portfolio";
import {
  createReviewHistoryRecord,
  filterReviewHistory,
  loadReviewHistory,
  prependReviewHistory,
  saveReviewHistory,
  updateReviewHistoryVerification,
} from "@/lib/security/reviewHistory";
import { evaluateRisk } from "@/lib/security/risk";
import {
  readXLayerErc20Evidence,
  readXLayerNativeBalance,
  readXLayerReceiptTokenDeltas,
  simulateOnXLayer,
  verifyXLayerReceipt,
} from "@/lib/security/simulation";
import {
  connectWallet,
  connectedXLayerNetwork,
  ensureXLayerNetwork,
  getInjectedWallet,
  readWalletAccounts,
  readWalletState,
  submitThroughWallet,
} from "@/lib/security/wallet";
import type {
  ManagedWallet,
  ReviewHistoryFilter,
  ReviewHistoryRecord,
  TransactionAnalysis,
  TransactionDraft,
  WalletPortfolio,
  WalletState,
  XLayerNetworkKey,
} from "@/lib/security/types";

const initialScenario =
  DEMO_SCENARIOS.find(item => item.id === "safe-transfer")?.id ??
  DEMO_SCENARIOS[0].id;
const GUARDIAN_LOGO_URL = "/xlogo.png";
type ScenarioId = (typeof DEMO_SCENARIOS)[number]["id"];
type Section = PortfolioSection;
const blankWallet: WalletState = {
  available: false,
  connected: false,
  providerLabel: "Checking wallet",
};
const portfolioSections: Section[] = [
  "overview",
  "wallets",
  "scan",
  "activity",
  "profile",
];
function initialPortfolioSection(): Section {
  const candidate =
    typeof window === "undefined" ? "" : window.location.hash.replace("#", "");
  return portfolioSections.includes(candidate as Section)
    ? (candidate as Section)
    : "overview";
}
function short(value?: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "No wallet";
}
function walletTitle(wallet: ManagedWallet) {
  return wallet.label || short(wallet.address);
}
function formatDecodedAmount(
  amountRaw: string | undefined,
  decimals: number | undefined,
  fallback: string
) {
  if (
    !amountRaw ||
    fallback === "Unlimited" ||
    typeof decimals !== "number" ||
    !Number.isInteger(decimals)
  )
    return fallback;
  try {
    return formatUnits(BigInt(amountRaw), decimals);
  } catch {
    return fallback;
  }
}
function CaseGrid({
  selectedId,
  onSelect,
}: {
  selectedId: ScenarioId;
  onSelect: (id: ScenarioId) => void;
}) {
  return (
    <div className="scenario-grid two-column-grid">
      {DEMO_SCENARIOS.map((scenario, index) => (
        <button
          key={scenario.id}
          className={selectedId === scenario.id ? "selected" : ""}
          onClick={() => onSelect(scenario.id)}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{scenario.shortName}</strong>
            <small>{SCENARIO_ACTIONS[scenario.id].label}</small>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [section, setSection] = useState<Section>(initialPortfolioSection);
  const [selectedId, setSelectedId] = useState<ScenarioId>(initialScenario);
  const [wallet, setWallet] = useState<WalletState>(blankWallet);
  const [portfolio, setPortfolio] = useState<WalletPortfolio>(emptyPortfolio);
  const [portfolioReady, setPortfolioReady] = useState(false);
  const [watchAddress, setWatchAddress] = useState("");
  const [watchLabel, setWatchLabel] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [selectedNetwork, setSelectedNetwork] =
    useState<XLayerNetworkKey>("testnet");
  const [lastIntent, setLastIntent] = useState("Send tokens");
  const [liveAnalysis, setLiveAnalysis] = useState<TransactionAnalysis>();
  const [lastDraft, setLastDraft] = useState({
    to: "",
    value: "0",
    data: "0x",
    declaredAction: "",
  });
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryRecord[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyFilter, setHistoryFilter] =
    useState<ReviewHistoryFilter>("all");
  const [latestReviewId, setLatestReviewId] = useState<string>();
  const scenario = useMemo(
    () =>
      DEMO_SCENARIOS.find(item => item.id === selectedId) ?? DEMO_SCENARIOS[0],
    [selectedId]
  );
  const analysis = mode === "demo" ? scenario.analysis : liveAnalysis;
  const network =
    selectedNetwork === "mainnet"
      ? XLAYER_CONFIG.mainnet
      : XLAYER_CONFIG.testnet;
  const analysisNetwork =
    analysis?.draft.chainId === XLAYER_CONFIG.mainnet.chainId
      ? XLAYER_CONFIG.mainnet
      : XLAYER_CONFIG.testnet;
  const activeNetwork = connectedXLayerNetwork(wallet);
  const activeWallet = activePortfolioWallet(portfolio);
  const activeAddress = activeWallet?.address ?? wallet.address;
  const action = SCENARIO_ACTIONS[scenario.id];
  const activeCanSign = canRequestSignature(activeWallet, wallet);
  const signingReady = canOpenWalletConfirmation(analysis);
  const explanation = trpc.guardian.explain.useMutation();
  const tokenTarget =
    analysis &&
    ["erc20-approval", "erc20-transfer", "erc20-transfer-from"].includes(
      analysis.decoded.kind
    )
      ? analysis.decoded.target
      : undefined;
  const tokenIdentity = trpc.guardian.tokenIdentity.useQuery(
    {
      chainId: analysis?.draft.chainId ?? 0,
      address: tokenTarget ?? "0x0000000000000000000000000000000000000000",
    },
    { enabled: Boolean(tokenTarget) }
  );
  const visibleHistory = useMemo(
    () => filterReviewHistory(reviewHistory, historyFilter),
    [reviewHistory, historyFilter]
  );
  const addConnectedAccounts = (accounts: string[], preferred?: string) => {
    setPortfolio(current => {
      let next = current;
      for (const [index, address] of accounts.entries()) {
        try {
          next = upsertPortfolioWallet(
            next,
            createManagedWallet(
              address,
              index === 0
                ? "Primary signing wallet"
                : `Connected account ${index + 1}`,
              "connected"
            )
          );
        } catch {
          /* Ignore malformed provider account values. */
        }
      }
      const preferredWallet = next.wallets.find(
        item => item.address.toLowerCase() === preferred?.toLowerCase()
      );
      return preferredWallet
        ? setActivePortfolioWallet(next, preferredWallet.id)
        : next;
    });
  };
  const navigate = (next: Section) => {
    setSection(next);
    if (typeof window !== "undefined" && window.location.hash !== `#${next}`)
      window.history.replaceState(null, "", `#${next}`);
  };
  useEffect(() => {
    const bootstrap = async () => {
      const saved = loadPortfolio(window.localStorage);
      setPortfolio(saved);
      setPortfolioReady(true);
      setReviewHistory(loadReviewHistory(window.localStorage));
      setHistoryReady(true);
      try {
        const state = await readWalletState();
        setWallet(state);
        if (state.connected)
          addConnectedAccounts(await readWalletAccounts(), state.address);
      } catch {
        setWallet({
          available: false,
          connected: false,
          providerLabel: "Wallet unavailable",
        });
      }
    };
    void bootstrap();
  }, []);
  useEffect(() => {
    const provider = getInjectedWallet();
    if (!provider?.on) return;
    const refresh = async () => {
      try {
        const state = await readWalletState(provider);
        setWallet(state);
        if (state.connected)
          addConnectedAccounts(
            await readWalletAccounts(provider),
            state.address
          );
      } catch {
        setWallet({
          available: false,
          connected: false,
          providerLabel: "Wallet unavailable",
        });
      }
    };
    const handleChange = () => {
      void refresh();
    };
    provider.on("accountsChanged", handleChange);
    provider.on("chainChanged", handleChange);
    return () => {
      provider.removeListener?.("accountsChanged", handleChange);
      provider.removeListener?.("chainChanged", handleChange);
    };
  }, []);
  useEffect(() => {
    const onHashChange = () => setSection(initialPortfolioSection());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  useEffect(() => {
    if (portfolioReady) savePortfolio(portfolio, window.localStorage);
  }, [portfolio, portfolioReady]);
  useEffect(() => {
    if (historyReady) saveReviewHistory(reviewHistory, window.localStorage);
  }, [reviewHistory, historyReady]);
  const recordReview = (
    nextAnalysis: TransactionAnalysis,
    source: "demo" | "live"
  ) => {
    const record = createReviewHistoryRecord(nextAnalysis, source);
    setReviewHistory(current => prependReviewHistory(current, record));
    setLatestReviewId(record.id);
  };
  const selectScenario = (id: ScenarioId) => {
    const nextScenario = DEMO_SCENARIOS.find(item => item.id === id);
    if (nextScenario) recordReview(nextScenario.analysis, "demo");
    setSelectedId(id);
    setMode("demo");
    navigate("overview");
    setNotice(undefined);
    setError(undefined);
  };
  const connect = async () => {
    setIsConnecting(true);
    setError(undefined);
    try {
      const state = await connectWallet();
      setWallet(state);
      addConnectedAccounts(await readWalletAccounts(), state.address);
      setMode("live");
      setSection("scan");
      setNotice(
        "Browser wallet connected. Guardian has not requested a signature."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Wallet connection was not completed."
      );
    } finally {
      setIsConnecting(false);
    }
  };
  const addWatchWallet = () => {
    try {
      const nextWallet = createManagedWallet(watchAddress, watchLabel, "watch");
      setPortfolio(current => upsertPortfolioWallet(current, nextWallet));
      setWatchAddress("");
      setWatchLabel("");
      setNotice(`${nextWallet.label} is now a watch-only wallet.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Guardian could not add that wallet."
      );
    }
  };
  const switchNetwork = async () => {
    try {
      await ensureXLayerNetwork(network);
      setWallet(await readWalletState());
      setNotice(`Wallet switched to ${network.name}.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Wallet network switch did not complete."
      );
    }
  };
  const inspect = async (liveDraft: {to: string; value: string; data: string; declaredAction: string}, intentKind: string) => {
    setLastDraft(liveDraft);
    setLastIntent(intentKind);
    if (!activeAddress) {
      setError(
        "Connect a signing wallet or add a watch wallet before scanning."
      );
      return;
    }
    setIsInspecting(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const draft: TransactionDraft = {
        from: activeAddress,
        to: liveDraft.to,
        value: parseEther(liveDraft.value || "0").toString(),
        data: liveDraft.data || "0x",
        chainId: network.chainId,
        declaredAction: liveDraft.declaredAction.trim() || intentKind,
      };
      const decoded = decodeTransaction(draft);
      const isErc20 =
        decoded.kind === "erc20-approval" ||
        decoded.kind === "erc20-transfer" ||
        decoded.kind === "erc20-transfer-from";
      const [simulation, balance, erc20Evidence] = await Promise.all([
        simulateOnXLayer(draft),
        readXLayerNativeBalance(activeAddress, network.chainId),
        isErc20
          ? readXLayerErc20Evidence(
              activeAddress,
              decoded.target,
              network.chainId,
              decoded.spender
            )
          : Promise.resolve(undefined),
      ]);
      const before = [
        {
          asset: "native",
          symbol: network.nativeSymbol,
          amount: balance.amount ?? "Unavailable",
          valueLabel: balance.detail,
        },
        ...(erc20Evidence
          ? [
              {
                asset: erc20Evidence.tokenAddress,
                symbol: erc20Evidence.symbol,
                amount: erc20Evidence.balance,
                valueLabel: erc20Evidence.detail,
                allowance: erc20Evidence.allowance,
                spender: erc20Evidence.spender,
              },
            ]
          : []),
      ];
      const movements = decodedAssetMovements(
        decoded,
        network.nativeSymbol
      ).map(movement =>
        erc20Evidence &&
        movement.asset.toLowerCase() ===
          erc20Evidence.tokenAddress.toLowerCase()
          ? {
              ...movement,
              symbol: erc20Evidence.symbol,
              amount: formatDecodedAmount(
                decoded.amountRaw,
                erc20Evidence.decimals,
                movement.amount
              ),
            }
          : movement
      );
      const assetComparison = createLiveAssetComparison(
        before,
        movements,
        Boolean(XLAYER_CONFIG.traceProviderUrl)
      );
      const reputation = {
        status: XLAYER_CONFIG.reputationApiUrl
          ? ("unavailable" as const)
          : ("unknown" as const),
        provider: XLAYER_CONFIG.reputationApiUrl
          ? "Configured provider"
          : "Not configured",
        detail: XLAYER_CONFIG.reputationApiUrl
          ? "A reputation endpoint exists but no adapter is enabled."
          : "No external trust provider is configured.",
      };
      const nextAnalysis = {
        draft,
        decoded,
        simulation,
        reputation,
        risk: evaluateRisk({
          draft,
          decoded,
          simulation,
          reputation,
          erc20Evidence,
        }),
        before: assetComparison.before,
        after: assetComparison.after,
        movements: assetComparison.movements,
        assetComparison,
        erc20Evidence,
        verification: {
          status: "not-verified" as const,
          label: "Not submitted",
          detail: "No wallet request has been made.",
        },
      };
      setLiveAnalysis(nextAnalysis);
      recordReview(nextAnalysis, "live");
      setSection("overview");
      setNotice(
        `Review complete for ${activeWallet ? walletTitle(activeWallet) : "the active wallet"}.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Guardian could not inspect this request."
      );
    } finally {
      setIsInspecting(false);
    }
  };
  const submit = async () => {
    if (!liveAnalysis || !activeCanSign || !wallet.address) {
      setError(
        "Select the connected signing wallet before requesting confirmation."
      );
      return;
    }
    if (!canOpenWalletConfirmation(liveAnalysis)) {
      setError(
        "Complete a successful X Layer simulation with no critical findings before opening the wallet."
      );
      return;
    }
    if (wallet.chainId !== liveAnalysis.draft.chainId) {
      setError(
        "Switch the wallet to the same X Layer network used for inspection."
      );
      return;
    }
    setIsSubmitting(true);
    setError(undefined);
    try {
      const hash = await submitThroughWallet({
        from: wallet.address,
        to: liveAnalysis.draft.to,
        value: liveAnalysis.draft.value,
        data: liveAnalysis.draft.data,
      });
      const verification = await verifyXLayerReceipt(
        hash,
        liveAnalysis.draft.chainId
      );
      const [refreshedNative, refreshedToken, receiptTrace] =
        verification.status === "verified"
          ? await Promise.all([
              readXLayerNativeBalance(
                wallet.address,
                liveAnalysis.draft.chainId
              ),
              liveAnalysis.erc20Evidence
                ? readXLayerErc20Evidence(
                    wallet.address,
                    liveAnalysis.erc20Evidence.tokenAddress,
                    liveAnalysis.draft.chainId,
                    liveAnalysis.erc20Evidence.spender
                  )
                : Promise.resolve(undefined),
              readXLayerReceiptTokenDeltas(
                hash,
                wallet.address,
                liveAnalysis.draft.chainId
              ),
            ])
          : [undefined, undefined, undefined];
      setLiveAnalysis(current => {
        if (!current) return current;
        const after = [
          ...(refreshedNative?.amount
            ? [
                {
                  asset: "native",
                  symbol: network.nativeSymbol,
                  amount: refreshedNative.amount,
                  valueLabel: refreshedNative.detail,
                },
              ]
            : []),
          ...(refreshedToken
            ? [
                {
                  asset: refreshedToken.tokenAddress,
                  symbol: refreshedToken.symbol,
                  amount: refreshedToken.balance,
                  valueLabel: refreshedToken.detail,
                  allowance: refreshedToken.allowance,
                  spender: refreshedToken.spender,
                },
              ]
            : []),
        ];
        const assetComparison = after.length
          ? createVerifiedAssetComparison(
              current.before,
              after,
              current.movements
            )
          : current.assetComparison;
        return {
          ...current,
          verification,
          erc20Evidence: refreshedToken ?? current.erc20Evidence,
          traceDeltas:
            receiptTrace && receiptTrace.status !== "unavailable"
              ? receiptTrace.deltas
              : current.traceDeltas,
          traceStatus: receiptTrace?.status ?? current.traceStatus,
          traceDetail: receiptTrace?.detail ?? current.traceDetail,
          assetComparison,
          after: assetComparison?.after ?? current.after,
        };
      });
      if (latestReviewId)
        setReviewHistory(current =>
          updateReviewHistoryVerification(
            current,
            latestReviewId,
            verification.status,
            hash
          )
        );
      setNotice(
        "Wallet returned a transaction hash. Guardian is checking the X Layer receipt, token balances, and configured trace evidence."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Wallet request was rejected."
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const requestExplanation = () => {
    if (!analysis) return;
    explanation.mutate(
      {
        intent:
          analysis.draft.declaredAction || "No stated intent was supplied.",
        actual: analysis.decoded.summary,
        network: analysisNetwork.name,
        simulation: {
          status: analysis.simulation.status,
          detail: analysis.simulation.detail,
          gasEstimate: analysis.simulation.gasEstimate,
        },
        findings: analysis.risk.findings.map(finding => ({
          title: finding.title,
          detail: finding.detail,
          level: finding.level,
        })),
        movements: analysis.movements.map(movement => ({
          symbol: movement.symbol,
          amount: movement.amount,
          direction: movement.direction,
          detail: movement.detail,
        })),
      },
      {
        onError: () =>
          setError(
            "Guardian could not generate an AI explanation. The deterministic review remains available."
          ),
      }
    );
  };
  const recover = () => {
    setMode("live");
    navigate("scan");
    setNotice(
      "Correct the transaction details, then run a new X Layer simulation before requesting a wallet confirmation."
    );
  };
  const openScenarioAction = () => {
    setNotice(action.description);
    navigate(action.section);
  };
  const navItems = [
    { id: "overview", label: "Overview", Icon: HomeIcon },
    { id: "wallets", label: "Wallets", Icon: WalletCards },
    { id: "scan", label: "Scan", Icon: ScanLine },
    { id: "activity", label: "Activity", Icon: Activity },
    { id: "profile", label: "Profile", Icon: UserRound },
  ] as const;
  return (
    <div className="night-app portfolio-app">
      <header className="night-header">
        <a href="#top" className="night-brand">
          <span className="brand-logo">
            <img src={GUARDIAN_LOGO_URL} alt="" />
          </span>
          GUARDIAN
        </a>
        <div className="night-header-state">
          <i className={mode} />
          {activeWallet
            ? `${walletTitle(activeWallet)} · ${activeWallet.kind === "connected" ? "signer" : "watch"}`
            : "No wallet selected"}
        </div>
        <button
          className="night-connect"
          onClick={connect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <Wallet size={15} />
          )}
          {wallet.connected ? "Connect another" : "Connect wallet"}
        </button>
      </header>
      <main className="night-main" id="top">
        <section className="night-intro">
          <div>
            <span>XLAYER SECURITY PORTFOLIO</span>
            <h1>
              {section === "overview"
                ? "Every wallet. One calm view."
                : section === "wallets"
                  ? "Manage your wallet set."
                  : section === "scan"
                    ? "Scan before signing."
                    : section === "activity"
                      ? "Review history, kept local."
                      : "Your Guardian boundary."}
            </h1>
            <p>
              {section === "overview"
                ? "Select a wallet, understand the consequence, and act deliberately."
                : activeWallet
                  ? `${walletTitle(activeWallet)} is the active ${activeWallet.kind === "connected" ? "signing" : "watch-only"} wallet.`
                  : "Add or connect a wallet to build your security portfolio."}
            </p>
          </div>
          <WalletPicker
            activeWallet={activeWallet}
            wallets={portfolio.wallets}
            onSelect={walletId =>
              setPortfolio(current =>
                setActivePortfolioWallet(current, walletId)
              )
            }
          />
        </section>
        {notice && (
          <div className="night-notice">
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>{notice}</span>
            <button
              onClick={() => setNotice(undefined)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="night-error">
            <AlertCircle size={15} aria-hidden="true" />
            <span>{error}</span>
            <button
              onClick={() => setError(undefined)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
        <nav className="desktop-product-nav" aria-label="Guardian workspace">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        {section === "overview" && (
          <>
            <section className="portfolio-summary">
              <div className="active-wallet-card">
                <div className="active-wallet-copy">
                  <img src={GUARDIAN_LOGO_URL} alt="" />
                  <div>
                    <span>Active wallet</span>
                    <h2>
                      {activeWallet
                        ? walletTitle(activeWallet)
                        : "No wallet yet"}
                    </h2>
                    <p>
                      {activeWallet
                        ? `${short(activeWallet.address)} · ${activeWallet.kind === "connected" ? "Connected signing wallet" : "Watch-only monitoring"}`
                        : "Connect a browser wallet or add a watch address."}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSection("wallets")}>
                  {activeWallet ? "Manage wallets" : "Add wallet"}
                  <ArrowRight size={15} />
                </button>
              </div>
              <div className="portfolio-stat">
                <span>X Layer network</span>
                <strong>
                  {analysisNetwork.key === "mainnet" ? "Mainnet" : "Testnet"}
                </strong>
                <small>Chain {analysisNetwork.chainId}</small>
              </div>
              <div className="portfolio-stat">
                <span>Attention</span>
                <strong>
                  {scenario.analysis.risk.level === "safe"
                    ? "Clear"
                    : scenario.analysis.risk.level}
                </strong>
                <small>From selected review</small>
              </div>
            </section>
            <section className="overview-row">
              <div className="case-strip">
                <div>
                  <span>Security reviews</span>
                  <small>Each case has its own next step</small>
                </div>
                <CaseGrid selectedId={selectedId} onSelect={selectScenario} />
              </div>
              <div className="case-action-card">
                <span>Selected case action</span>
                <h2>{action.label}</h2>
                <p>{action.description}</p>
                <button onClick={openScenarioAction}>
                  {action.label}
                  <ArrowRight size={15} />
                </button>
              </div>
            </section>
            {analysis ? (
              <>
                <AnalysisBoard
                  key={
                    mode === "demo"
                      ? scenario.id
                      : `${analysis.draft.to}-${analysis.draft.data}`
                  }
                  analysis={analysis}
                  mode={mode}
                  networkName={analysisNetwork.name}
                  tokenIdentity={tokenIdentity.data}
                  aiExplanation={explanation.data}
                  isExplaining={explanation.isPending}
                  onExplain={requestExplanation}
                  onRecover={recover}
                />
                {mode === "live" && (
                  <section className="wallet-card">
                    <div>
                      <span>Signing boundary</span>
                      <h2>
                        {activeCanSign
                          ? signingReady
                            ? "Ready for your wallet confirmation."
                            : "Simulation must pass before a wallet can open."
                          : "This is a watch-only review."}
                      </h2>
                      <p>
                        {activeCanSign
                          ? signingReady
                            ? "Guardian can request confirmation only after this successful X Layer review."
                            : "Correct the findings or transaction fields, then run another review."
                          : "Select the connected wallet to request a confirmation."}
                      </p>
                    </div>
                    <button
                      onClick={submit}
                      disabled={isSubmitting || !signingReady || !activeCanSign}
                    >
                      {isSubmitting ? (
                        <LoaderCircle className="spin" size={15} />
                      ) : (
                        <Wallet size={15} />
                      )}
                      {!signingReady
                        ? "Simulate first"
                        : activeCanSign
                          ? "Open wallet"
                          : "Watch-only"}
                    </button>
                  </section>
                )}
              </>
            ) : (
              <section className="night-section empty-screen">
                <ShieldCheck size={24} />
                <h2>No review loaded</h2>
                <p>
                  Start a scan with the active wallet or choose a deterministic
                  case.
                </p>
              </section>
            )}
          </>
        )}
        {section === "wallets" && (
          <section className="wallet-management">
            <header>
              <div>
                <span>Wallet portfolio</span>
                <h2>Connected and watch-only, clearly separated.</h2>
              </div>
              <button onClick={connect} disabled={isConnecting}>
                {isConnecting ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Wallet size={15} />
                )}
                Connect browser wallet
              </button>
            </header>
            <div className="add-watch-wallet">
              <div>
                <span>
                  <Plus size={14} /> Add a watch wallet
                </span>
                <p>
                  Watch wallets are stored in this browser and can never sign.
                </p>
              </div>
              <input
                value={watchLabel}
                onChange={event => setWatchLabel(event.target.value)}
                placeholder="Label, e.g. Treasury"
              />
              <input
                value={watchAddress}
                onChange={event => setWatchAddress(event.target.value)}
                placeholder="0x… wallet address"
              />
              <button onClick={addWatchWallet}>
                <Plus size={15} />
                Add wallet
              </button>
            </div>
            <div className="managed-wallet-list">
              {portfolio.wallets.length ? (
                portfolio.wallets.map(item => (
                  <article
                    key={item.id}
                    className={
                      item.id === activeWallet?.id
                        ? "managed-wallet active"
                        : "managed-wallet"
                    }
                  >
                    <div className={`wallet-kind ${item.kind}`}>
                      <Wallet size={16} />
                    </div>
                    <div>
                      <div className="wallet-name">
                        <strong>{walletTitle(item)}</strong>
                        <span>
                          {item.kind === "connected" ? "SIGNER" : "WATCH"}
                        </span>
                      </div>
                      <p>{item.address}</p>
                      <small>
                        {item.kind === "connected"
                          ? "Can request a client-side wallet confirmation."
                          : "Read-only simulation and balance context."}
                      </small>
                    </div>
                    <div className="wallet-item-actions">
                      <button
                        onClick={() =>
                          setPortfolio(current =>
                            setActivePortfolioWallet(current, item.id)
                          )
                        }
                      >
                        {item.id === activeWallet?.id
                          ? "Active"
                          : "Make active"}
                      </button>
                      <button
                        className="remove"
                        onClick={() =>
                          setPortfolio(current =>
                            removePortfolioWallet(current, item.id)
                          )
                        }
                        aria-label={`Remove ${item.label}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="wallet-empty">
                  <WalletCards size={22} />
                  <h3>Your portfolio is empty</h3>
                  <p>
                    Connect a browser wallet or add a watch address to start
                    managing your security context.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
        {section === "scan" && (
          <section className="night-section inspect-screen">
            <header>
              <div>
                <span>Active wallet scan</span>
                <h2>
                  {activeWallet
                    ? `Scan for ${walletTitle(activeWallet)}`
                    : "Select a wallet to scan"}
                </h2>
              </div>
              <p>
                <Eye size={14} />{" "}
                {activeWallet?.kind === "watch"
                  ? "Watch-only simulation."
                  : "No signature in review."}
              </p>
            </header>
            <div className="network-tabs">
              <button
                className={selectedNetwork === "testnet" ? "active" : ""}
                onClick={() => setSelectedNetwork("testnet")}
              >
                Testnet
              </button>
              <button
                className={selectedNetwork === "mainnet" ? "active" : ""}
                onClick={() => setSelectedNetwork("mainnet")}
              >
                Mainnet
              </button>
              {wallet.connected && wallet.chainId !== network.chainId && (
                <button className="fix" onClick={switchNetwork}>
                  <Network size={13} />
                  Switch
                </button>
              )}
            </div>
            <ScanForm
              activeWallet={activeWallet}
              activeAddress={activeAddress}
              isInspecting={isInspecting}
              onInspect={inspect}
              initialDraft={lastDraft}
              initialIntent={lastIntent}
            />
          </section>
        )}
        {section === "activity" && (
          <section className="activity-screen">
            <header>
              <div>
                <span>Local review history</span>
                <h2>Your X Layer reviews, kept in this browser.</h2>
              </div>
              <small>{reviewHistory.length} saved</small>
            </header>
            <div
              className="history-filters"
              role="group"
              aria-label="Filter review history"
            >
              {(
                [
                  "all",
                  "live",
                  "demo",
                  "safe",
                  "warning",
                  "critical",
                ] as ReviewHistoryFilter[]
              ).map(filter => (
                <button
                  key={filter}
                  className={historyFilter === filter ? "active" : ""}
                  onClick={() => setHistoryFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
            {visibleHistory.length ? (
              <div className="history-list">
                {visibleHistory.map(item => (
                  <article key={item.id}>
                    <div className={`activity-mark mark-${item.riskLevel}`}>
                      <History size={17} aria-hidden="true" />
                    </div>
                    <div>
                      <span>
                        {new Date(item.createdAt).toLocaleString()} · chain{" "}
                        {item.chainId}
                      </span>
                      <strong>{item.consequence}</strong>
                      <p>
                        {item.method} · {item.source} ·{" "}
                        {item.verification.replace("-", " ")}
                        {item.walletAddress
                          ? ` · ${short(item.walletAddress)}`
                          : ""}
                      </p>
                    </div>
                    <div className={`history-risk risk-${item.riskLevel}`}>
                      {item.riskLevel}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="history-empty">
                <History size={22} />
                <h3>No matching reviews</h3>
                <p>
                  Reviews stay only in this browser. Run a live scan or choose a
                  demo case to begin your history.
                </p>
              </div>
            )}
            <details className="demo-guides">
              <summary>Demo case guides</summary>
              <div className="activity-list">
                {DEMO_SCENARIOS.map(item => {
                  const itemAction = SCENARIO_ACTIONS[item.id];
                  const level = item.analysis.risk.level;
                  const RiskIcon =
                    level === "safe"
                      ? ShieldCheck
                      : level === "warning"
                        ? CircleAlert
                        : ShieldAlert;
                  return (
                    <article key={item.id}>
                      <div className={`activity-mark mark-${level}`}>
                        <RiskIcon
                          size={18}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <span>{item.shortName}</span>
                        <strong>{itemAction.label}</strong>
                        <p>{itemAction.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedId(item.id);
                          setMode("demo");
                          recordReview(item.analysis, "demo");
                          setNotice(itemAction.description);
                          navigate(itemAction.section);
                        }}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </article>
                  );
                })}
              </div>
            </details>
          </section>
        )}
        {section === "profile" && (
          <section className="night-section profile-screen">
            <div className="account-avatar">
              <img src={GUARDIAN_LOGO_URL} alt="Guardian sentinel" />
            </div>
            <h2>Guardian is local by design.</h2>
            <p>
              Your managed wallet labels and watch addresses are stored in this
              browser. Wallet keys never enter Guardian, and only the currently
              connected signing wallet can request a transaction confirmation.
            </p>
            <div>
              <span>
                <ShieldCheck size={15} /> Client-side signing
              </span>
              <span>
                <ClipboardCheck size={15} /> Local portfolio metadata
              </span>
              <span>
                <LockKeyhole size={15} /> No custody
              </span>
            </div>
          </section>
        )}
        <footer className="night-footer">
          X Layer state simulation · active wallet:{" "}
          {activeWallet ? short(activeWallet.address) : "not selected"}
        </footer>
      </main>
      <nav className="bottom-nav" aria-label="Guardian workspace">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={section === id ? "active" : ""}
            onClick={() => navigate(id)}
            aria-current={section === id ? "page" : undefined}
          >
            <span>
              <Icon size={20} strokeWidth={2.1} aria-hidden="true" />
            </span>
            <b>{label}</b>
          </button>
        ))}
      </nav>
    </div>
  );
}
