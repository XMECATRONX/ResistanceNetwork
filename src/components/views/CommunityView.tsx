import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Server,
  Wallet,
  Vote,
  Shield,
  BookOpen,
  ChevronDown,
  Coins,
  Radio,
  Zap,
  HelpCircle,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";

interface FAQItem {
  q: string;
  a: string;
}

const VALIDATOR_STEPS = [
  {
    title: "1. Install Rust",
    description: "Install the Rust toolchain (1.75+)",
    code: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env`,
  },
  {
    title: "2. Clone & Build",
    description: "Clone the RSTN node repository and compile",
    code: `git clone https://github.com/resistance/rstn-node.git
cd rstn-node
cargo build --release`,
  },
  {
    title: "3. Generate Keypair",
    description: "Generate your Dilithium3 validator keypair",
    code: `./target/release/rstn-node keygen --output validator.keys
# Outputs: publicKey (1952 bytes), secretKey (4032 bytes)
# Address: rstn1...`,
  },
  {
    title: "4. Register as Validator",
    description: "Register on-chain and stake the minimum required RSTN",
    code: `./target/release/rstn-node register-validator \\
  --keys validator.keys \\
  --stake 100000 \\
  --commission 5 \\
  --shard 0`,
  },
  {
    title: "5. Start Validating",
    description: "Run the node and start producing blocks",
    code: `./target/release/rstn-node \\
  --validator --keys validator.keys \\
  --port 9944 --p2p-port 9945 \\
  --name "my-validator"`,
  },
  {
    title: "6. Monitor & Maintain",
    description: "Keep your node online and monitor performance",
    code: `# Check your validator status
curl -X POST http://localhost:9944 \\
  -H "Content-Type: application/json" \\
  -d '{"method":"rstn_getValidator","params":["YOUR_ADDRESS"]}'`,
  },
];

const STAKING_GUIDE = [
  {
    step: "Connect Wallet",
    desc: "Open the RSTN Terminal and connect your wallet (Dilithium3 keypair)",
    icon: Wallet,
  },
  {
    step: "Choose Validator",
    desc: "Browse the validator list — compare uptime, commission and APY",
    icon: Server,
  },
  {
    step: "Delegate RSTN",
    desc: "Select a validator and delegate your stake. Minimum: 1 RSTN",
    icon: Coins,
  },
  {
    step: "Earn Rewards",
    desc: "Rewards accrue automatically. Claim anytime or compound",
    icon: Zap,
  },
  {
    step: "Vote in Governance",
    desc: "Use your staked RSTN to vote on proposals — 1 RSTN = 1 vote",
    icon: Vote,
  },
  {
    step: "Unstake",
    desc: "Unbonding period: 14 days. Your stake is slashable during this window",
    icon: Shield,
  },
];

const FAQS: FAQItem[] = [
  {
    q: "What makes RSTN quantum-resistant?",
    a: "RSTN uses NIST FIPS 204 (ML-DSA-65 / Dilithium3) for all digital signatures, NIST FIPS 203 (ML-KEM-768 / Kyber768) for key encapsulation, and SHA-3 (Keccak) for hashing. These lattice-based and hash-based schemes are resistant to Shor's and Grover's algorithms, which break ECDSA, Ed25519 and RSA on quantum computers.",
  },
  {
    q: "Do I need special hardware to run a validator?",
    a: "No. RSTN uses Proof-of-Stake with post-quantum signatures. You need: 4+ CPU cores, 8GB RAM, 500GB SSD, and stable internet (10+ Mbps). No GPUs, no ASICs. Dilithium3 signing is CPU-efficient.",
  },
  {
    q: "What is the minimum stake to become a validator?",
    a: "100,000 RSTN for a validator node. For delegation (participating in staking without running a node), the minimum is 1 RSTN.",
  },
  {
    q: "How does slashing work?",
    a: "Slashing occurs for: (1) Double-signing different blocks at the same height — 5% stake penalty + jail. (2) Downtime exceeding 10% of blocks per epoch — warning, then 1% penalty. (3) Surround votes — 10% penalty. Repeated offenses escalate. Jailed validators cannot propose or vote until the jail period ends.",
  },
  {
    q: "What is the unbonding period?",
    a: "14 days. During this period, your stake is still slashable if you committed a violation before unstaking. This prevents 'hit-and-run' attacks.",
  },
  {
    q: "Is RSTN compatible with MetaMask?",
    a: "No. MetaMask uses secp256k1 (ECDSA), which is vulnerable to quantum attacks. RSTN uses the RSTN Wallet Chrome extension with Dilithium3 (ML-DSA-65) signatures. This is a deliberate security choice — compatibility with classical crypto would undermine the post-quantum guarantee.",
  },
  {
    q: "What is the Quantum Migration Program?",
    a: "It allows users to migrate assets from pre-quantum blockchains (BTC, ETH, SOL, BSC, AVAX, ADA, DOT, NEAR) to RSTN with 1:1 backing. The original capital is verifiably locked or burned before the post-quantum equivalent is minted on RSTN.",
  },
  {
    q: "How is RSTN distributed?",
    a: "Fair launch: 1,000,000,000 RSTN total supply. No ICO, no pre-sale, no founder allocation. Distribution through staking rewards, governance participation, and the Quantum Migration Program.",
  },
  {
    q: "What is the block time and finality?",
    a: "Block time: 0.4 seconds. Finality is deterministic — once a block is committed via 3-phase BFT (Propose → Prepare → Commit), it is final and cannot be reorganized. No probabilistic finality like Bitcoin's 6-confirmation rule.",
  },
  {
    q: "How many shards does RSTN have?",
    a: "64 dynamic shards. Each shard processes transactions independently, enabling horizontal scaling. Cross-shard communication uses atomic commits. Target throughput: 250K TPS across all shards.",
  },
  {
    q: "Can I run a non-validator node?",
    a: "Yes. You can run a full node (syncs the entire chain) or a light node (syncs headers only). Full nodes help network decentralization and can serve RPC requests. No stake required for non-validator nodes.",
  },
  {
    q: "What happens if quantum computers break ECDSA before I migrate?",
    a: "Any funds in pre-quantum addresses (BTC, ETH) with exposed public keys become vulnerable. The Quantum Migration Program lets you move them to RSTN proactively. We recommend migrating before quantum computers reach sufficient scale (estimated 2029-2033).",
  },
];

const RESOURCES = [
  {
    title: "Whitepaper",
    desc: "Full technical specification",
    link: "#",
    icon: BookOpen,
  },
  {
    title: "Node Documentation",
    desc: "Setup, configuration, maintenance",
    link: "#",
    icon: Server,
  },
  {
    title: "SDK Reference",
    desc: "TypeScript SDK for dApps",
    link: "/dev",
    icon: BookOpen,
  },
  { title: "RPC API", desc: "JSON-RPC 2.0 methods", link: "/dev", icon: Radio },
  {
    title: "GitHub",
    desc: "Source code and issues",
    link: "#",
    icon: ExternalLink,
  },
  { title: "Discord", desc: "Community and support", link: "#", icon: Users },
];

const CommunityView = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">
            Community & Resources
          </h2>
          <p className="text-sm text-muted-foreground">
            Validator guides, staking tutorials, FAQ and developer resources
          </p>
        </div>
      </div>

      {/* Validator Setup Guide */}
      <Panel
        title="Validator Setup Guide"
        description="Become a RSTN validator in 6 steps"
        delay={0}
      >
        <div className="space-y-4">
          {VALIDATOR_STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg border border-border p-4"
            >
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold">
                    {step.title.replace(/^\d+\.\s*/, "")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
              <div className="relative mt-2">
                <pre className="overflow-x-auto rounded-lg bg-[#0a0a14] p-3 pr-10 font-mono text-xs leading-relaxed text-foreground/80">
                  <code>{step.code}</code>
                </pre>
                <button
                  onClick={() => copyCode(step.code)}
                  className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                  aria-label="Copy code"
                >
                  {copiedCode === step.code ? (
                    <span className="text-xs text-primary">Copied</span>
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* Staking Guide */}
      <Panel
        title="Staking Guide"
        description="How to stake, delegate and earn rewards"
        delay={0.1}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STAKING_GUIDE.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border border-border p-4 transition-colors hover:border-primary/30"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-mono text-xs text-muted-foreground">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="mb-1 text-sm font-semibold">{item.step}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </Panel>

      {/* FAQ */}
      <Panel title="FAQ" description="Frequently asked questions" delay={0.15}>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-border"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface-1/50"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="text-sm font-medium">{faq.q}</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                />
              </button>
              {openFaq === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </p>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Resources */}
      <Panel
        title="Resources"
        description="Documentation and community links"
        delay={0.2}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((res, i) => {
            const Icon = res.icon;
            return (
              <motion.a
                key={i}
                href={res.link}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/30 hover:bg-surface-1/50"
              >
                <Icon className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">{res.title}</h3>
                  <p className="text-xs text-muted-foreground">{res.desc}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.a>
            );
          })}
        </div>
      </Panel>
    </div>
  );
};

export default CommunityView;
