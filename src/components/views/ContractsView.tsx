import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  Upload,
  Play,
  Search,
  Check,
  AlertCircle,
  Loader2,
  Wallet,
  Copy,
  FileCode2,
  Terminal,
  Zap,
  Shield,
} from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { api, RPC_MODE } from "@/lib/api";
import { isValidHex, isValidRstnAddress } from "@/lib/validation";

// ─── Sample bytecode (a minimal contract that returns 0x42) ──────
// PUSH1 0x42 | PUSH1 0x00 | MSTORE | PUSH1 0x20 | PUSH1 0x00 | RETURN
const SAMPLE_BYTECODE = "0x604260005260206000f3";

type Tab = "deploy" | "call" | "read";

interface LogEntry {
  type: "success" | "error" | "info";
  text: string;
  timestamp: number;
}

export const ContractsView = () => {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>("deploy");

  // Deploy state
  const [bytecode, setBytecode] = useState(SAMPLE_BYTECODE);
  const [deploying, setDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [deployTxHash, setDeployTxHash] = useState<string | null>(null);

  // Call state
  const [callAddress, setCallAddress] = useState("");
  const [callData, setCallData] = useState("0x");
  const [callValue, setCallValue] = useState("0");
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState<{
    success: boolean;
    gasUsed: number;
    output: string;
    error?: string;
  } | null>(null);

  // Read state
  const [readAddress, setReadAddress] = useState("");
  const [readCode, setReadCode] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);

  const addLog = (type: LogEntry["type"], text: string) => {
    setLogs((prev) =>
      [{ type, text, timestamp: Date.now() }, ...prev].slice(0, 20),
    );
  };

  // ── Deploy a contract ──
  const handleDeploy = async () => {
    if (!wallet.address || wallet.status !== "connected") return;
    if (!bytecode || bytecode === "0x") {
      addLog("error", "Bytecode vacío — pega el bytecode a desplegar");
      return;
    }
    if (!isValidHex(bytecode, { minLength: 2 })) {
      addLog("error", "Bytecode inválido — debe ser hexadecimal (0x6080...)");
      return;
    }

    setDeploying(true);
    setDeployedAddress(null);
    setDeployTxHash(null);
    addLog("info", "Firmando transacción de deploy con Dilithium3...");

    try {
      // Predict the contract address before deploying
      let nonce = 0;
      try {
        const portfolio = await api.getWalletPortfolio(wallet.address);
        nonce = portfolio.nonce ?? 0;
      } catch {
        /* default 0 */
      }

      const predicted = await api.getContractAddress(wallet.address, nonce);
      setDeployedAddress(predicted.address);
      addLog("info", `Dirección predicha: ${predicted.address}`);

      // Sign + submit the deploy transaction
      const result = await wallet.sign({
        to: "rstn1deploy000000000000000000000000000000",
        value: "0",
        type: "ContractDeploy",
        data: bytecode,
      });

      setDeployTxHash(result.hash);
      addLog(
        "success",
        `Contrato desplegado. Tx: ${result.hash.slice(0, 18)}... Espera 1 bloque para confirmación.`,
      );

      // Wait a moment for block production, then set call address
      setTimeout(() => {
        setCallAddress(predicted.address);
        setReadAddress(predicted.address);
      }, 1500);
    } catch (err) {
      addLog(
        "error",
        err instanceof Error ? err.message : "Error al desplegar el contrato",
      );
    } finally {
      setDeploying(false);
    }
  };

  // ── Read-only call (eth_call equivalent) ──
  const handleCall = async () => {
    if (!callAddress) {
      addLog("error", "Pega la dirección del contrato");
      return;
    }
    if (!isValidRstnAddress(callAddress)) {
      addLog("error", "Dirección inválida — debe empezar por rstn1...");
      return;
    }
    setCalling(true);
    setCallResult(null);
    addLog("info", `Llamando contrato ${callAddress.slice(0, 14)}...`);

    try {
      const result = await api.callContract(
        callAddress,
        callData,
        wallet.address || undefined,
        callValue,
      );
      setCallResult(result);
      if (result.success) {
        addLog(
          "success",
          `Llamada exitosa · ${result.gasUsed} gas · output: ${result.output.slice(0, 24)}${result.output.length > 24 ? "..." : ""}`,
        );
      } else {
        addLog("error", result.error || "La llamada revirtió o falló");
      }
    } catch (err) {
      addLog(
        "error",
        err instanceof Error ? err.message : "Error en la llamada",
      );
    } finally {
      setCalling(false);
    }
  };

  // ── Read contract bytecode ──
  const handleRead = async () => {
    if (!readAddress) {
      addLog("error", "Pega la dirección del contrato a inspeccionar");
      return;
    }
    if (!isValidRstnAddress(readAddress)) {
      addLog("error", "Dirección inválida — debe empezar por rstn1...");
      return;
    }
    setReading(true);
    setReadCode(null);
    addLog("info", `Leyendo bytecode de ${readAddress.slice(0, 14)}...`);

    try {
      const code = await api.getCode(readAddress);
      setReadCode(code);
      if (code) {
        addLog("success", `Bytecode encontrado: ${code.length} caracteres hex`);
      } else {
        addLog("info", "No hay contrato en esa dirección (null)");
      }
    } catch (err) {
      addLog(
        "error",
        err instanceof Error ? err.message : "Error al leer el contrato",
      );
    } finally {
      setReading(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { id: Tab; label: string; icon: typeof Code2 }[] = [
    { id: "deploy", label: "Desplegar", icon: Upload },
    { id: "call", label: "Llamar", icon: Play },
    { id: "read", label: "Inspeccionar", icon: Search },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Mode banner ── */}
      <div
        className="flex items-center gap-3 rounded-lg border border-border p-4"
        style={{ background: "hsl(150 100% 45% / 0.04)" }}
      >
        <span
          className="dot"
          style={{
            background: "hsl(150 100% 45%)",
            boxShadow: "0 0 6px hsl(150 100% 45% / 0.40)",
          }}
        />
        <p className="font-body text-xs leading-relaxed text-muted-foreground">
          <span
            className="font-semibold"
            style={{ color: "hsl(150 100% 45%)" }}
          >
            RstnVM —{" "}
          </span>
          {RPC_MODE
            ? "Conectado a rstn-node. La VM ejecuta un subconjunto de bytecode EVM (opcodes 0x00–0xEF) con opcodes post-cuánticos (OP_VALID_SIG). Los deploys requieren firma Dilithium3."
            : "Modo demostración. Conecta un nodo para ejecutar contratos reales en la RstnVM."}
        </p>
      </div>

      {/* ── Wallet connect gate ── */}
      {wallet.status !== "connected" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-sig p-8 text-center"
        >
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: "hsl(150 100% 45% / 0.12)",
              border: "1px solid hsl(150 100% 45% / 0.25)",
            }}
          >
            <FileCode2
              className="h-8 w-8"
              style={{ color: "hsl(150 100% 45%)" }}
              strokeWidth={1.5}
            />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-foreground">
            Consola de Smart Contracts
          </h2>
          <p className="mt-2 font-body text-sm text-muted-foreground max-w-md mx-auto">
            Despliega, llama e inspecciona contratos en la RstnVM. Conecta tu
            wallet para firmar transacciones con Dilithium3.
          </p>
          <motion.button
            onClick={wallet.connect}
            disabled={wallet.status === "connecting"}
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-body text-sm font-semibold transition-all"
            style={{
              background: "hsl(150 100% 45%)",
              color: "hsl(150 50% 10%)",
              boxShadow: "0 4px 20px hsl(150 100% 45% / 0.25)",
            }}
          >
            {wallet.status === "connecting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Conectando...
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" strokeWidth={2} /> Conectar Wallet
              </>
            )}
          </motion.button>
        </motion.div>
      )}

      {/* ── Main console ── */}
      {wallet.status === "connected" && (
        <>
          {/* Tabs */}
          <div
            className="flex gap-1 rounded-xl p-1"
            style={{
              background: "hsl(150 14% 10%)",
              border: "1px solid var(--border)",
            }}
          >
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="relative flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-body text-xs font-medium transition-all"
                  style={{
                    background: active
                      ? "hsl(150 100% 45% / 0.15)"
                      : "transparent",
                    color: active
                      ? "hsl(150 100% 45%)"
                      : "var(--muted-foreground)",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Deploy tab ── */}
            {tab === "deploy" && (
              <motion.div
                key="deploy"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="card-sig p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Upload
                    className="h-4 w-4"
                    style={{ color: "hsl(150 100% 45%)" }}
                    strokeWidth={1.5}
                  />
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Desplegar Contrato
                  </h3>
                </div>

                <div>
                  <label className="label-muted text-[10px]">
                    Bytecode (hex)
                  </label>
                  <textarea
                    value={bytecode}
                    onChange={(e) => setBytecode(e.target.value)}
                    rows={4}
                    className="mt-1.5 w-full resize-none rounded-lg p-3 font-mono text-xs text-foreground"
                    style={{
                      background: "hsl(150 14% 8%)",
                      border: "1px solid var(--border)",
                    }}
                    placeholder="0x60806040..."
                  />
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {bytecode.length} chars ·{" "}
                      {Math.max(0, bytecode.replace("0x", "").length / 2)} bytes
                    </p>
                    <button
                      onClick={() => setBytecode(SAMPLE_BYTECODE)}
                      className="font-body text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Cargar ejemplo
                    </button>
                  </div>
                </div>

                <motion.button
                  onClick={handleDeploy}
                  disabled={deploying || !bytecode || bytecode === "0x"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-body text-sm font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: "hsl(150 100% 45%)",
                    color: "hsl(0 0% 100%)",
                    boxShadow: "0 4px 20px hsl(150 100% 45% / 0.25)",
                  }}
                >
                  {deploying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Firmando
                      deploy Dilithium3...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" strokeWidth={2} /> Desplegar
                      Contrato
                    </>
                  )}
                </motion.button>

                {/* Deploy result */}
                {deployedAddress && (
                  <div
                    className="space-y-3 rounded-lg p-4"
                    style={{
                      background: "hsl(150 100% 45% / 0.06)",
                      border: "1px solid hsl(150 100% 45% / 0.20)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Check
                        className="h-4 w-4"
                        style={{ color: "hsl(150 100% 45%)" }}
                      />
                      <p
                        className="font-body text-xs font-semibold"
                        style={{ color: "hsl(150 100% 45%)" }}
                      >
                        Deploy enviado
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="label-muted text-[9px]">
                        Dirección del contrato
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate font-mono text-xs text-foreground">
                          {deployedAddress}
                        </code>
                        <button
                          onClick={() => copyAddress(deployedAddress)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {copied ? (
                            <Check
                              className="h-3.5 w-3.5"
                              style={{ color: "hsl(150 100% 45%)" }}
                            />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {deployTxHash && (
                      <div className="space-y-1.5">
                        <p className="label-muted text-[9px]">
                          Hash de transacción
                        </p>
                        <code className="block truncate font-mono text-xs text-muted-foreground">
                          {deployTxHash}
                        </code>
                      </div>
                    )}
                    <button
                      onClick={() => setTab("call")}
                      className="font-body text-[11px] text-muted-foreground underline transition-colors hover:text-foreground"
                    >
                      Ir a Llamar →
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Call tab ── */}
            {tab === "call" && (
              <motion.div
                key="call"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="card-sig p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Play
                    className="h-4 w-4"
                    style={{ color: "hsl(150 100% 45%)" }}
                    strokeWidth={1.5}
                  />
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Llamar Contrato
                  </h3>
                </div>

                <div>
                  <label className="label-muted text-[10px]">
                    Dirección del contrato
                  </label>
                  <input
                    value={callAddress}
                    onChange={(e) => setCallAddress(e.target.value)}
                    className="mt-1.5 w-full rounded-lg p-3 font-mono text-xs text-foreground"
                    style={{
                      background: "hsl(150 14% 8%)",
                      border: "1px solid var(--border)",
                    }}
                    placeholder="rstn1..."
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="label-muted text-[10px]">
                      Calldata (hex)
                    </label>
                    <input
                      value={callData}
                      onChange={(e) => setCallData(e.target.value)}
                      className="mt-1.5 w-full rounded-lg p-3 font-mono text-xs text-foreground"
                      style={{
                        background: "hsl(150 14% 8%)",
                        border: "1px solid var(--border)",
                      }}
                      placeholder="0x"
                    />
                  </div>
                  <div>
                    <label className="label-muted text-[10px]">
                      Value (wei)
                    </label>
                    <input
                      value={callValue}
                      onChange={(e) => setCallValue(e.target.value)}
                      className="mt-1.5 w-full rounded-lg p-3 font-mono text-xs text-foreground"
                      style={{
                        background: "hsl(150 14% 8%)",
                        border: "1px solid var(--border)",
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>

                <motion.button
                  onClick={handleCall}
                  disabled={calling || !callAddress}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-body text-sm font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: "hsl(150 100% 45%)",
                    color: "hsl(0 0% 100%)",
                    boxShadow: "0 4px 20px hsl(150 100% 45% / 0.25)",
                  }}
                >
                  {calling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Ejecutando en
                      VM...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" strokeWidth={2} /> Ejecutar
                      Llamada
                    </>
                  )}
                </motion.button>

                {/* Call result */}
                {callResult && (
                  <div
                    className="rounded-lg p-4"
                    style={{
                      background: callResult.success
                        ? "hsl(150 100% 45% / 0.06)"
                        : "hsl(5 80% 55% / 0.06)",
                      border: `1px solid ${callResult.success ? "hsl(150 100% 45% / 0.20)" : "hsl(5 80% 55% / 0.20)"}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {callResult.success ? (
                        <Check
                          className="h-4 w-4"
                          style={{ color: "hsl(150 100% 45%)" }}
                        />
                      ) : (
                        <AlertCircle
                          className="h-4 w-4"
                          style={{ color: "hsl(5 80% 55%)" }}
                        />
                      )}
                      <p
                        className="font-body text-xs font-semibold"
                        style={{
                          color: callResult.success
                            ? "hsl(150 100% 45%)"
                            : "hsl(5 80% 55%)",
                        }}
                      >
                        {callResult.success
                          ? "Llamada exitosa"
                          : "La llamada falló"}
                      </p>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {callResult.gasUsed} gas
                      </span>
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="label-muted text-[9px]">Output</p>
                      <code className="block break-all font-mono text-xs text-foreground">
                        {callResult.output || "0x"}
                      </code>
                    </div>
                    {callResult.error && (
                      <p
                        className="mt-2 font-mono text-[10px]"
                        style={{ color: "hsl(5 80% 55%)" }}
                      >
                        {callResult.error}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Read tab ── */}
            {tab === "read" && (
              <motion.div
                key="read"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="card-sig p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Search
                    className="h-4 w-4"
                    style={{ color: "hsl(150 100% 45%)" }}
                    strokeWidth={1.5}
                  />
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Inspeccionar Contrato
                  </h3>
                </div>

                <div>
                  <label className="label-muted text-[10px]">
                    Dirección del contrato
                  </label>
                  <input
                    value={readAddress}
                    onChange={(e) => setReadAddress(e.target.value)}
                    className="mt-1.5 w-full rounded-lg p-3 font-mono text-xs text-foreground"
                    style={{
                      background: "hsl(150 14% 8%)",
                      border: "1px solid var(--border)",
                    }}
                    placeholder="rstn1..."
                  />
                </div>

                <motion.button
                  onClick={handleRead}
                  disabled={reading || !readAddress}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-body text-sm font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: "hsl(150 100% 45%)",
                    color: "hsl(0 0% 100%)",
                    boxShadow: "0 4px 20px hsl(150 100% 45% / 0.25)",
                  }}
                >
                  {reading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Leyendo...
                    </>
                  ) : (
                    <>
                      <Code2 className="h-4 w-4" strokeWidth={2} /> Leer
                      Bytecode
                    </>
                  )}
                </motion.button>

                {/* Read result */}
                {readCode !== null && (
                  <div
                    className="rounded-lg p-4"
                    style={{
                      background: readCode
                        ? "hsl(150 100% 45% / 0.06)"
                        : "hsl(150 14% 10%)",
                      border: `1px solid ${readCode ? "hsl(150 100% 45% / 0.20)" : "var(--border)"}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {readCode ? (
                        <Check
                          className="h-4 w-4"
                          style={{ color: "hsl(150 100% 45%)" }}
                        />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <p
                        className="font-body text-xs font-semibold"
                        style={{
                          color: readCode
                            ? "hsl(150 100% 45%)"
                            : "var(--muted-foreground)",
                        }}
                      >
                        {readCode
                          ? "Contrato encontrado"
                          : "Sin contrato en esta dirección"}
                      </p>
                    </div>
                    {readCode && (
                      <div className="mt-3 space-y-1">
                        <p className="label-muted text-[9px]">
                          Bytecode · {readCode.length} chars ·{" "}
                          {Math.max(0, readCode.replace("0x", "").length / 2)}{" "}
                          bytes
                        </p>
                        <code
                          className="block max-h-48 overflow-y-auto break-all rounded-lg p-3 font-mono text-[11px] text-foreground"
                          style={{ background: "hsl(150 14% 6%)" }}
                        >
                          {readCode}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Activity log ── */}
          {logs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-sig p-5"
            >
              <div className="flex items-center gap-2">
                <Terminal
                  className="h-4 w-4 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Registro de actividad
                </h3>
                <button
                  onClick={() => setLogs([])}
                  className="ml-auto font-body text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Limpiar
                </button>
              </div>
              <div className="mt-4 space-y-1.5">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 font-mono text-[11px]"
                  >
                    <span className="text-muted-foreground/50">
                      {new Date(log.timestamp).toLocaleTimeString("es-ES", {
                        hour12: false,
                      })}
                    </span>
                    <span
                      style={{
                        color:
                          log.type === "success"
                            ? "hsl(150 100% 45%)"
                            : log.type === "error"
                              ? "hsl(5 80% 55%)"
                              : "var(--muted-foreground)",
                      }}
                    >
                      {log.type === "success"
                        ? "✓"
                        : log.type === "error"
                          ? "✗"
                          : "→"}
                    </span>
                    <span className="flex-1 text-muted-foreground">
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── VM info ── */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Code2,
                label: "Opcodes",
                value: "EVM + PQ",
                color: "hsl(150 100% 45%)",
              },
              {
                icon: Zap,
                label: "Gas PQ sig",
                value: "500",
                color: "hsl(150 70% 50%)",
              },
              {
                icon: Shield,
                label: "Reentrancy",
                value: "Protegido",
                color: "hsl(150 100% 45%)",
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                  className="card-sig p-4"
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className="h-4 w-4"
                      style={{ color: item.color }}
                      strokeWidth={1.5}
                    />
                    <span className="label-muted text-[9px]">{item.label}</span>
                  </div>
                  <p className="mt-2 font-mono text-sm font-bold text-foreground">
                    {item.value}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
