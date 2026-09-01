import { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Server,
  Code,
  Terminal,
  FileCode,
  Copy,
  Check,
} from "lucide-react";
import {
  DOC_SECTIONS,
  QUICKSTART_STEPS,
  SDK_INFO,
  RPC_METHODS,
  CODE_EXAMPLES,
} from "@/lib/protocol";

const ICONS: Record<string, typeof Zap> = {
  Zap,
  Server,
  Code,
  Terminal,
  FileCode,
};

export const DocsView = () => {
  const [activeSection, setActiveSection] = useState("quickstart");
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ── Disclaimer ── */}
      <div
        className="flex items-center gap-3 rounded-lg border border-border p-4"
        style={{ background: "hsl(150 70% 50% / 0.04)" }}
      >
        <span
          className="dot"
          style={{
            background: "hsl(150 70% 50%)",
            boxShadow: "0 0 6px hsl(150 70% 50% / 0.40)",
          }}
        />
        <p className="font-body text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold" style={{ color: "hsl(150 70% 50%)" }}>
            Documentación técnica —{" "}
          </span>
          Especificación de referencia para node operators y dApp developers.
          Los comandos y APIs serán funcionales tras el lanzamiento de testnet
          pública.
        </p>
      </div>

      {/* ── Section tabs ── */}
      <div className="flex flex-wrap gap-2">
        {DOC_SECTIONS.map((section) => {
          const Icon = ICONS[section.icon] || Zap;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className="flex items-center gap-2 rounded-lg border px-4 py-2.5 font-body text-sm font-medium transition-all"
              style={{
                background: isActive
                  ? "hsl(150 100% 45% / 0.08)"
                  : "hsl(150 14% 9%)",
                borderColor: isActive
                  ? "hsl(150 100% 45% / 0.30)"
                  : "var(--border)",
                color: isActive
                  ? "hsl(150 100% 45%)"
                  : "var(--muted-foreground)",
              }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              {section.label}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeSection}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        {activeSection === "quickstart" && (
          <QuickStartSection copied={copied} copyCode={copyCode} />
        )}
        {activeSection === "node" && <NodeSection />}
        {activeSection === "sdk" && (
          <SDKSection copied={copied} copyCode={copyCode} />
        )}
        {activeSection === "rpc" && <RPCSection />}
        {activeSection === "examples" && (
          <ExamplesSection copied={copied} copyCode={copyCode} />
        )}
      </motion.div>
    </div>
  );
};

// ═══ QUICK START ═══
const QuickStartSection = ({
  copied,
  copyCode,
}: {
  copied: string | null;
  copyCode: (code: string, id: string) => void;
}) => (
  <div className="space-y-4">
    <div>
      <h3 className="font-display text-base font-semibold text-foreground">
        Quick Start
      </h3>
      <p className="mt-1 font-body text-sm text-muted-foreground">
        De cero a validador en 4 pasos.
      </p>
    </div>
    {QUICKSTART_STEPS.map((step, i) => (
      <motion.div
        key={step.step}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: i * 0.08 }}
        className="card-sig p-5"
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold"
            style={{
              background: "hsl(150 100% 45% / 0.12)",
              color: "hsl(150 100% 45%)",
            }}
          >
            {step.step}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h4 className="font-display text-sm font-semibold text-foreground">
                {step.title}
              </h4>
              <p className="mt-0.5 font-body text-xs text-muted-foreground">
                {step.description}
              </p>
            </div>
            <CodeBlock
              code={step.code}
              id={`qs-${step.step}`}
              copied={copied}
              onCopy={copyCode}
            />
          </div>
        </div>
      </motion.div>
    ))}
  </div>
);

// ═══ NODE OPERATORS ═══
const NodeSection = () => (
  <div className="space-y-6">
    <div>
      <h3 className="font-display text-base font-semibold text-foreground">
        Node Operators
      </h3>
      <p className="mt-1 font-body text-sm text-muted-foreground">
        Guía de instalación y operación de rstn-node.
      </p>
    </div>

    {/* Hardware requirements */}
    <div className="card-sig p-5">
      <h4 className="font-display text-sm font-semibold text-foreground">
        Requisitos de Hardware
      </h4>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "CPU", value: "4 cores", note: "mínimo" },
          { label: "RAM", value: "8 GB", note: "16 GB rec." },
          { label: "Storage", value: "100 GB", note: "SSD NVMe" },
          { label: "Red", value: "Puerto 31402", note: "estable" },
        ].map((req) => (
          <div
            key={req.label}
            className="rounded-lg border border-border p-3"
            style={{ background: "hsl(150 14% 9%)" }}
          >
            <p className="label-muted text-[9px]">{req.label}</p>
            <p className="mt-1 font-mono text-sm font-bold text-foreground">
              {req.value}
            </p>
            <p className="font-body text-[10px] text-muted-foreground">
              {req.note}
            </p>
          </div>
        ))}
      </div>
    </div>

    {/* Docker setup */}
    <div className="card-sig p-5">
      <h4 className="font-display text-sm font-semibold text-foreground">
        Despliegue con Docker
      </h4>
      <p className="mt-1 font-body text-xs text-muted-foreground">
        Recomendado para la mayoría de operadores.
      </p>
      <CodeBlock
        code={`# 1. Pull de la imagen oficial
docker pull rstn/node:latest

# 2. Ejecutar nodo validador
docker run -d --name rstn-node \\
  -p 31402:31402 \\
  -p 31403:31403 \\
  -v rstn-data:/data \\
  -v rstn-keys:/keys \\
  rstn/node:latest --mainnet

# 3. Verificar logs
docker logs -f rstn-node

# 4. Estado del nodo
docker exec rstn-node rstn status`}
        id="node-docker"
        copied={null}
        onCopy={() => {}}
      />
    </div>

    {/* Config */}
    <div className="card-sig p-5">
      <h4 className="font-display text-sm font-semibold text-foreground">
        Configuración
      </h4>
      <p className="mt-1 font-body text-xs text-muted-foreground">
        Archivo rstn.toml en el directorio de datos.
      </p>
      <CodeBlock
        code={`# rstn.toml
[network]
mainnet = true
shard = 12          # Shard preferido (auto-asignado si vacío)

[consensus]
validator = true
stake = 32000       # RSTN

[crypto]
scheme = "dilithium3"
hash = "keccak-512"

[p2p]
port = 31402
peers = 50          # Máximo de conexiones

[storage]
path = "/data"
backend = "sled"
pruning = "archive" # o "full" para nodos ligeros`}
        id="node-config"
        copied={null}
        onCopy={() => {}}
      />
    </div>
  </div>
);

// ═══ SDK ═══
const SDKSection = ({
  copied,
  copyCode,
}: {
  copied: string | null;
  copyCode: (code: string, id: string) => void;
}) => (
  <div className="space-y-6">
    <div>
      <h3 className="font-display text-base font-semibold text-foreground">
        SDK & dApps
      </h3>
      <p className="mt-1 font-body text-sm text-muted-foreground">
        Herramientas para construir sobre RSTN.
      </p>
    </div>
    {SDK_INFO.map((sdk, i) => (
      <motion.div
        key={sdk.name}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: i * 0.08 }}
        className="card-sig p-5"
      >
        <div className="flex items-center justify-between">
          <h4 className="font-display text-sm font-semibold text-foreground">
            {sdk.name}
          </h4>
          <code
            className="rounded-md border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground"
            style={{ background: "hsl(150 14% 9%)" }}
          >
            {sdk.install}
          </code>
        </div>
        <p className="mt-2 font-body text-xs text-muted-foreground">
          {sdk.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sdk.features.map((f) => (
            <span key={f} className="tag text-[10px]">
              {f}
            </span>
          ))}
        </div>
        <div className="mt-4">
          <CodeBlock
            code={sdk.code}
            id={`sdk-${i}`}
            copied={copied}
            onCopy={copyCode}
          />
        </div>
      </motion.div>
    ))}
  </div>
);

// ═══ RPC API ═══
const RPCSection = () => (
  <div className="space-y-6">
    <div>
      <h3 className="font-display text-base font-semibold text-foreground">
        JSON-RPC API
      </h3>
      <p className="mt-1 font-body text-sm text-muted-foreground">
        Endpoints disponibles en el RPC de rstn-node.
      </p>
    </div>

    {/* Endpoint info */}
    <div className="card-sig p-4">
      <div className="flex items-center gap-3">
        <span className="dot live-badge" />
        <code className="font-mono text-xs text-foreground">
          https://rpc.rstn.network
        </code>
        <span className="tag text-[10px]">JSON-RPC 2.0</span>
        <span className="tag text-[10px]">WebSocket</span>
      </div>
    </div>

    {/* Methods table */}
    <div
      className="overflow-hidden rounded-lg border border-border"
      style={{ background: "hsl(150 14% 9%)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr
              className="border-b border-border"
              style={{ background: "hsl(150 14% 7%)" }}
            >
              <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Método
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Parámetros
              </th>
              <th className="hidden px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                Retorna
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Descripción
              </th>
            </tr>
          </thead>
          <tbody>
            {RPC_METHODS.map((m, i) => (
              <motion.tr
                key={m.method}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                className="border-b border-border/50 transition-colors hover:bg-surface-2"
              >
                <td className="px-4 py-3">
                  <span
                    className="font-mono text-xs font-medium"
                    style={{ color: "hsl(150 100% 45%)" }}
                  >
                    {m.method}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {m.params}
                  </span>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <span className="font-mono text-xs text-foreground">
                    {m.returns}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-body text-xs text-muted-foreground">
                    {m.description}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// ═══ EXAMPLES ═══
const ExamplesSection = ({
  copied,
  copyCode,
}: {
  copied: string | null;
  copyCode: (code: string, id: string) => void;
}) => (
  <div className="space-y-6">
    <div>
      <h3 className="font-display text-base font-semibold text-foreground">
        Ejemplos
      </h3>
      <p className="mt-1 font-body text-sm text-muted-foreground">
        Casos de uso reales con el SDK y la API.
      </p>
    </div>
    {CODE_EXAMPLES.map((ex, i) => (
      <motion.div
        key={ex.title}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: i * 0.06 }}
        className="card-sig p-5"
      >
        <div className="flex items-center justify-between">
          <h4 className="font-display text-sm font-semibold text-foreground">
            {ex.title}
          </h4>
          <span className="tag text-[10px]">{ex.language}</span>
        </div>
        <div className="mt-3">
          <CodeBlock
            code={ex.code}
            id={`ex-${i}`}
            copied={copied}
            onCopy={copyCode}
          />
        </div>
      </motion.div>
    ))}
  </div>
);

// ═══ SHARED CODE BLOCK ═══
const CodeBlock = ({
  code,
  id,
  copied,
  onCopy,
}: {
  code: string;
  id: string;
  copied: string | null;
  onCopy: (code: string, id: string) => void;
}) => (
  <div
    className="group relative overflow-hidden rounded-lg border border-border"
    style={{ background: "hsl(150 14% 6%)" }}
  >
    <button
      onClick={() => onCopy(code, id)}
      className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-border opacity-0 transition-opacity group-hover:opacity-100"
      style={{ background: "hsl(150 14% 12%)" }}
    >
      {copied === id ? (
        <Check
          className="h-3.5 w-3.5"
          style={{ color: "hsl(150 100% 45%)" }}
          strokeWidth={2}
        />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
      )}
    </button>
    <pre className="overflow-x-auto p-4">
      <code className="font-mono text-xs leading-relaxed text-foreground">
        {code}
      </code>
    </pre>
  </div>
);
