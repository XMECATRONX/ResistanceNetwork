import { motion } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  KeyRound,
  Fingerprint,
  Hash,
  AlertTriangle,
  AlertCircle,
  XCircle,
  CheckCircle2,
  GitBranch,
} from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { alpha } from "@/lib/utils";
import { PQ_MIGRATION_PATH } from "@/lib/protocol";
import {
  HONEST_NETWORK_STATS,
  HONEST_QUANTUM_DEFENSE,
} from "@/lib/protocolClaims";
import { QuantumDefenseList } from "@/components/views/QuantumDefenseList";

// Honest crypto suite — only what is ACTUALLY implemented
const CRYPTO_SUITE_IMPLEMENTED = [
  {
    name: "CRYSTAL-Dilithium3",
    purpose: "Firmas digitales post-cuánticas",
    nist: "FIPS 204",
    type: "Lattice-based (LWE)",
    keySize: "1,952 bytes",
    sigSize: "3,293 bytes",
    quantumSecurity: "Nivel 3 (192-bit)",
    icon: KeyRound,
    color: "var(--primary)",
    description:
      "Reemplaza ECDSA/secp256k1. Basado en Module Learning With Errors (M-LWE). Estándar NIST para firmas post-cuánticas. Implementado y testeado (19 tests en rstn-crypto).",
  },
  {
    name: "Lattice-based VRF",
    purpose: "Verifiable Random Function post-cuántica",
    nist: "Module-LWE construction",
    type: "Lattice-based (M-LWE)",
    keySize: "1,536 bytes",
    sigSize: "1,024 bytes",
    quantumSecurity: "Nivel 3 (192-bit)",
    icon: Fingerprint,
    color: "var(--accent)",
    description:
      "Construcción de VRF sobre Module-LWE. Genera aleatoriedad verificable resistente a Shor. Implementado en rstn-crypto. Nota: la selección de líder actual usa round-robin por altura; el VRF está disponible para producción.",
  },
  {
    name: "Keccak-512 (SHA-3)",
    purpose: "Función hash criptográfica",
    nist: "FIPS 202",
    type: "Sponge construction",
    keySize: "—",
    sigSize: "64 bytes",
    quantumSecurity: "256-bit (Grover: 128-bit)",
    icon: Hash,
    color: "var(--violet)",
    description:
      "Hash resistente a ataques de Grover. Doble de seguridad que SHA-256 bajo computación cuántica. Implementado y testeado. Usado para bloques, direcciones y árboles Merkle.",
  },
  {
    name: "Kyber768 + X25519 (handshake)",
    purpose: "Key exchange híbrido post-cuántico",
    nist: "FIPS 203 + RFC 7748",
    type: "Lattice (KEM) + ECDH",
    keySize: "1,184 + 32 bytes",
    sigSize: "1,088 + 32 bytes",
    quantumSecurity: "Nivel 3 (192-bit)",
    icon: ShieldCheck,
    color: "hsl(150 70% 50%)",
    description:
      "Handshake híbrido Kyber768 KEM + X25519 ECDH + HKDF-SHA3-512. Implementado y criptográficamente correcto. Parcial: NO cableado al transporte libp2p — opera a nivel de aplicación. El transporte real usa Noise/X25519.",
  },
];

const CRYPTO_SUITE_ROADMAP = [
  {
    name: "Ed25519 (firma híbrida)",
    purpose: "Doble verificación con Dilithium3",
    nist: "RFC 8032",
    type: "Curvas elípticas (Ed25519)",
    description:
      "Plan: cada transacción se firma con Dilithium3 + Ed25519. Ambas validan. Defensa en profundidad. NO implementado en el código de consenso actual (solo Dilithium3).",
  },
  {
    name: "SPHINCS+ (fallback hash-based)",
    purpose: "Firmas hash-based de respaldo",
    nist: "FIPS 205",
    type: "Hash-based (Merkle trees)",
    description:
      "Plan: esquema hash-based independiente de retículos. Si Dilithium3 se compromete, SPHINCS+ sostiene. NO implementado. No está en Cargo.toml.",
  },
  {
    name: "LADKG (threshold DKG)",
    purpose: "Distributed Key Generation + mempool anti-MEV",
    nist: "IACR 2025/1946",
    type: "Lattice-based async DKG",
    description:
      "Plan: threshold Kyber para cifrar mempool antes del ordenamiento. Elimina MEV. NO implementado. Es investigación seria (Tier 3).",
  },
  {
    name: "zk-STARK",
    purpose: "Privacidad nativa + verificación ligera",
    nist: "Hash-based (no curves)",
    type: "Zero-knowledge proof",
    description:
      "Plan: zk-STARKs hash-based, sin trusted setup, PQ-resistente. Light clients verifican con Merkle Mountain Ranges. NO implementado. Es investigación seria (Tier 3).",
  },
  {
    name: "Account Abstraction PQ",
    purpose: "Cuentas como smart contracts que validan firmas PQ",
    nist: "FIPS 204",
    type: "Account abstraction",
    description:
      "Plan: cuentas que rotan claves sin cambiar la dirección on-chain. NO implementado. Modelo actual: pubkey → address determinístico.",
  },
];

export const CryptographyView = () => {
  const implementedCount = HONEST_QUANTUM_DEFENSE.filter(
    (d) => d.status === "implementado",
  ).length;
  const totalCount = HONEST_QUANTUM_DEFENSE.length;

  return (
    <div className="space-y-6">
      {/* Crypto suite — implemented */}
      <Panel
        title="Suite Criptográfica — Implementada"
        description="4 primitivos implementados y testeados. Dilithium3, Keccak-512, VRF (lattice), y handshake Kyber768+X25519 (parcial). Lo que el código hace hoy."
      >
        <div className="space-y-3">
          {CRYPTO_SUITE_IMPLEMENTED.map((crypto, i) => {
            const Icon = crypto.icon;
            return (
              <motion.div
                key={crypto.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-sig p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex items-start gap-3 lg:w-72">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: alpha(crypto.color, 0.1),
                        border: `1px solid ${alpha(crypto.color, 0.25)}`,
                      }}
                    >
                      <Icon
                        className="h-4 w-4"
                        style={{ color: crypto.color }}
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-semibold text-foreground">
                        {crypto.name}
                      </h4>
                      <p className="font-body text-xs text-muted-foreground">
                        {crypto.purpose}
                      </p>
                      <span
                        className="tag mt-1.5 inline-block text-[10px]"
                        style={{
                          borderColor: alpha(crypto.color, 0.2),
                          color: crypto.color,
                          background: alpha(crypto.color, 0.08),
                        }}
                      >
                        {crypto.nist}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className="font-body text-xs leading-relaxed text-muted-foreground">
                      {crypto.description}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-md border border-border bg-surface-1 px-2.5 py-1.5">
                        <span className="label-muted text-[9px]">Tipo</span>
                        <p className="mt-0.5 font-mono text-xs font-medium text-foreground">
                          {crypto.type}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-surface-1 px-2.5 py-1.5">
                        <span className="label-muted text-[9px]">Clave</span>
                        <p className="mt-0.5 font-mono text-xs font-medium text-foreground">
                          {crypto.keySize}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-surface-1 px-2.5 py-1.5">
                        <span className="label-muted text-[9px]">Firma</span>
                        <p className="mt-0.5 font-mono text-xs font-medium text-foreground">
                          {crypto.sigSize}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-surface-1 px-2.5 py-1.5">
                        <span className="label-muted text-[9px]">
                          Resistencia
                        </span>
                        <p className="mt-0.5 font-mono text-xs font-medium text-primary">
                          {crypto.quantumSecurity}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Panel>

      {/* Crypto suite — roadmap (NOT implemented) */}
      <Panel
        title="Suite Criptográfica — Roadmap (NO implementado)"
        description="5 primitivos planificados pero no en el código actual. Ed25519 híbrido, SPHINCS+, LADKG, zk-STARK, account abstraction. Honestidad primero."
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {CRYPTO_SUITE_ROADMAP.map((crypto, i) => (
            <motion.div
              key={crypto.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-hover p-3"
              style={{ borderColor: "hsl(5 80% 55% / 0.12)" }}
            >
              <div className="flex items-start gap-2 mb-2">
                <XCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: "hsl(5 80% 55%)" }}
                  strokeWidth={1.5}
                />
                <div className="flex-1">
                  <h4 className="font-display text-xs font-bold text-foreground">
                    {crypto.name}
                  </h4>
                  <p className="font-body text-[11px] text-muted-foreground">
                    {crypto.purpose}
                  </p>
                </div>
                <span
                  className="font-mono text-[9px] font-bold"
                  style={{ color: "hsl(5 80% 55%)" }}
                >
                  NO
                </span>
              </div>
              <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
                {crypto.description}
              </p>
              <span
                className="tag mt-2 inline-block text-[9px]"
                style={{
                  borderColor: alpha("hsl(150 100% 45%)", 0.2),
                  color: "hsl(150 100% 45%)",
                }}
              >
                {crypto.nist}
              </span>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* Quantum vs classical — HONEST table */}
      <Panel
        title="Seguridad: Clásica vs. Post-Cuántica"
        description="Solo lo que está en el código. 'Usado en RSTN' refleja el estado real."
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left label-muted">Algoritmo</th>
                <th className="px-4 py-3 text-left label-muted">Tipo</th>
                <th className="px-4 py-3 text-center label-muted">vs. Shor</th>
                <th className="px-4 py-3 text-center label-muted">
                  vs. Grover
                </th>
                <th className="px-4 py-3 text-center label-muted">
                  Usado en RSTN
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  algo: "ECDSA / secp256k1",
                  type: "Curvas elípticas",
                  shor: "✕ Roto",
                  grover: "⚠ Debilitado",
                  used: "✕ No",
                  danger: true,
                },
                {
                  algo: "PLONK / Halo2 (ZK-SNARK)",
                  type: "Curvas elípticas",
                  shor: "✕ Roto",
                  grover: "✓ Seguro",
                  used: "✕ No",
                  danger: true,
                },
                {
                  algo: "Dilithium3",
                  type: "Retículos (LWE)",
                  shor: "✓ Seguro",
                  grover: "✓ Seguro",
                  used: "✓ Firmas",
                  danger: false,
                },
                {
                  algo: "Lattice-VRF",
                  type: "Retículos (M-LWE)",
                  shor: "✓ Seguro",
                  grover: "✓ Seguro",
                  used: "✓ VRF (crypto)",
                  danger: false,
                },
                {
                  algo: "Kyber768 + X25519",
                  type: "KEM + ECDH",
                  shor: "✓ Híbrido",
                  grover: "✓ Seguro",
                  used: "✓ Handshake (parcial)",
                  danger: false,
                },
                {
                  algo: "Ed25519 (híbrido)",
                  type: "Curvas elípticas",
                  shor: "✕ Roto",
                  grover: "✓ Seguro",
                  used: "✕ Roadmap",
                  danger: true,
                },
                {
                  algo: "SPHINCS+",
                  type: "Hash-based",
                  shor: "✓ Seguro",
                  grover: "✓ Seguro",
                  used: "✕ No",
                  danger: true,
                },
                {
                  algo: "LADKG (threshold)",
                  type: "Retículos (Kyber)",
                  shor: "✓ Seguro",
                  grover: "✓ Seguro",
                  used: "✕ No",
                  danger: true,
                },
                {
                  algo: "zk-STARK",
                  type: "Hash-based",
                  shor: "✓ Seguro",
                  grover: "✓ Seguro",
                  used: "✕ No",
                  danger: true,
                },
                {
                  algo: "Keccak-512",
                  type: "Esponja",
                  shor: "✓ N/A",
                  grover: "✓ 256-bit",
                  used: "✓ Hash",
                  danger: false,
                },
              ].map((row) => (
                <tr
                  key={row.algo}
                  className="border-b border-border/40 last:border-0 transition-colors hover:bg-surface-1"
                >
                  <td className="px-4 py-3 font-mono text-sm font-medium text-foreground">
                    {row.algo}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground">
                    {row.type}
                  </td>
                  <td
                    className={`px-4 py-3 text-center font-mono text-xs ${row.danger ? "text-destructive" : "text-primary"}`}
                  >
                    {row.shor}
                  </td>
                  <td
                    className={`px-4 py-3 text-center font-mono text-xs ${row.danger ? "text-warning" : "text-primary"}`}
                  >
                    {row.grover}
                  </td>
                  <td
                    className={`px-4 py-3 text-center font-mono text-xs ${row.danger ? "text-muted-foreground" : "text-primary"}`}
                  >
                    {row.used}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Quantum Defense — honest 6 layers */}
      <Panel
        title="Quantum Defense — 6 Capas de Protección"
        description="Estado real de cada capa. Sin marketing — lo que el código hace hoy."
      >
        {/* Coverage bar — honest */}
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={1.5} />
              <span className="font-display text-sm font-semibold text-foreground">
                Cobertura post-cuántica real
              </span>
            </div>
            <span className="font-mono text-2xl font-bold text-primary">
              {implementedCount}/{totalCount}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${Math.round((implementedCount / totalCount) * 100)}%`,
              }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            />
          </div>
          <p className="mt-2 font-body text-xs text-muted-foreground">
            Implementadas: Dilithium3 (firmas) + Keccak-512 (hash) + VRF
            (lattice). Parcial: handshake PQ (no cableado a transporte).
            Roadmap: firmas híbridas, SPHINCS+. No implementado: stealth,
            quantum alarm, account abstraction.
          </p>
        </div>

        <QuantumDefenseList />
      </Panel>

      {/* PQ Migration Path */}
      <Panel
        title="Migration Path — Evolución Criptográfica"
        description="Dilithium3 no es eterno. El protocolo incluye un path formal para reemplazar esquemas cuando la investigación lo justifique."
      >
        <div className="space-y-3">
          {PQ_MIGRATION_PATH.map((phase, i) => {
            const statusConfig: Record<
              string,
              { icon: typeof CheckCircle2; label: string; color: string }
            > = {
              activo: {
                icon: CheckCircle2,
                label: "Activo",
                color: "hsl(150 100% 45%)",
              },
              pasivo: {
                icon: AlertCircle,
                label: "Pasivo",
                color: "hsl(150 70% 50%)",
              },
              condicional: {
                icon: GitBranch,
                label: "Condicional",
                color: "hsl(150 100% 45%)",
              },
            };
            const StatusIcon = statusConfig[phase.status]?.icon || GitBranch;
            return (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-sig p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex items-start gap-3 lg:w-72">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: alpha(phase.color, 0.1),
                        border: `1px solid ${alpha(phase.color, 0.25)}`,
                      }}
                    >
                      <span
                        className="font-mono text-sm font-bold"
                        style={{ color: phase.color }}
                      >
                        {phase.id}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-semibold text-foreground">
                        {phase.phase}
                      </h4>
                      <p className="font-body text-xs text-muted-foreground">
                        {phase.scheme}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <StatusIcon
                        className="h-3.5 w-3.5"
                        style={{ color: phase.color }}
                        strokeWidth={1.5}
                      />
                      <span
                        className="font-mono text-[10px] font-bold"
                        style={{ color: phase.color }}
                      >
                        {statusConfig[phase.status]?.label}
                      </span>
                    </div>
                    <p className="font-body text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Trigger:
                      </span>{" "}
                      {phase.trigger}
                    </p>
                    <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                      {phase.action}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
};
