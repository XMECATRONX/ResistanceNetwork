const en = {
  language: "Language",
  common: {
    simulated: "Simulated · Pre-mainnet",
  },
  // DevPortal
  dev: {
    nav: {
      home: "Home",
      tracks: "Tracks",
      tools: "Tools",
      sdk: "SDK",
      wallet: "Wallet",
      playground: "Playground",
      resources: "Resources",
    },
  },
  // Language switcher
  langName: "English",
  languageShort: "EN",

  // Landing — nav
  nav: {
    vision: "Vision",
    architecture: "Architecture",
    flow: "Flow",
    crypto: "Cryptography",
    global: "Global Network",
    security: "Security",
    migration: "Migration",
    economics: "Economics",
    tokenomics: "Tokenomics",
    roadmap: "Roadmap",
    build: "Build",
    terminal: "Terminal",
  },

  // Landing — hero
  hero: {
    badge: "Sovereign Layer 1 · Post-Quantum Cryptography",
    title:
      "The blockchain with <span class='gradient-text'>post-quantum resistance</span>",
    subtitle:
      "Resistance Network (RSTN) is a Layer 1 built from scratch with lattice-based post-quantum cryptography (NIST FIPS 203/204/205).",
    cta: "Explore the protocol",
    stats: {
      tps: "Target TPS",
      finality: "Finality",
      pqCoverage: "PQ Primitives",
      shards: "Shards",
    },
  },

  // Landing — sections
  sections: {
    vision: {
      label: "10 problems addressed",
      title: "The 10 diseases of blockchain — mitigated",
    },
    architecture: {
      label: "7-layer architecture",
      title: "Designed from scratch",
    },
    flow: {
      label: "Transaction flow",
      title: "From your wallet to finality in 0.4s",
      desc: "Every transaction goes through 5 stages: post-quantum signature, mempool, block proposal, BFT voting, and deterministic finality. No intermediaries, no reorgs.",
    },
    crypto: {
      label: "Post-quantum cryptography",
      title: "6 layers of post-quantum defense",
    },
    global: {
      label: "Decentralized global network",
      title: "Toward validators on 6 continents",
    },
    security: {
      label: "Defense in depth",
      title: "12 attack vectors — mitigated",
      desc: "Every known attack vector has a mitigation designed into the protocol. Defense in depth: 4 fully mitigated, 6 partial, 2 on roadmap. Not security through obscurity — verifiable defense in depth.",
    },
    migration: {
      label: "Quantum Migration Program",
      title: "The quantum refuge",
      bridgeSecurity: "Security",
      bridgeChains: "Chains",
      bridgeLatency: "Latency",
      hackLessonsTitle: "Lessons from historical hacks — $1.7B lost",
      migrationTitle: "How quantum migration works",
      supportedChainsTitle: "Supported chains — mainnet vs future",
      supportedChainsDesc:
        'We don\'t support "any chain" — each chain requires an implemented and audited light client',
      mainnetLabel: "Mainnet — Full design",
      futureLabel: "Future — Post-mainnet",
      uniquenessLabel: "Unique differentiator",
      solution: "Solution",
    },
    economics: {
      label: "Bridge economics",
      title: "Every bridge fee burns RSTN",
      deflationTitle: "Scarcity mechanism — double pressure",
      transparencyTitle: "Transparency dashboard — every burn verifiable",
      standardFee: "Standard fee",
      fastPath: "Fast-path",
      quantumMigration: "Quantum migration",
    },
    tokenomics: {
      label: "Tokenomics",
      title: "1,000,000,000 RSTN. Fair distribution.",
      distributionTitle: "Supply distribution",
      distributionSub: "Fair launch · No pre-sale",
      metrics: {
        hardCap: "Hard Cap",
        minStake: "Min Stake",
        apr: "APR",
        fairLaunch: "Fair Launch",
      },
    },
    roadmap: {
      label: "Roadmap",
      title: "From whitepaper to mainnet",
      deliverables: "deliverables",
    },
  },

  // Landing — footer
  footer: {
    description:
      "<span class='text-primary font-semibold'>RSTN</span> — resistance against the unknown: the quantum threat other blockchains ignore. A sovereign protocol, open source, with no owner.",
    terminal: "Terminal",
    devPortal: "DevPortal",
    backToTop: "Back to top",
  },

  // Mobile nav
  mobile: {
    openMenu: "Open menu",
    closeMenu: "Close menu",
    skipToContent: "Skip to content",
  },

  // Terminal — sidebar
  sidebar: {
    tagline: "Post-Quantum Cryptography",
    phase: "Phase 0 — Specification",
    phaseSub: "Pre-testnet · Q3 2026 — Q1 2027",
    disclaimer:
      "Experimental software. RSTN tokens have no guaranteed value. Staking carries slashing risk. Not an investment. Consult legal advice in your jurisdiction.",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    nav: {
      onboarding: "Guides",
      overview: "Overview",
      explorer: "Block Explorer",
      staking: "Staking + Wallet",
      faucet: "Faucet Testnet",
      contracts: "Smart Contracts",
      architecture: "Architecture",
      cryptography: "Cryptography",
      consensus: "Consensus",
      nodes: "Nodes",
      mining: "Participation",
      tokenomics: "Tokenomics",
      bridge: "Bridges & Migration",
      dex: "DEX · Price Pool",
      transparency: "Transparency",
      network: "Network Visualizer",
      monitoring: "Monitoring",
      security: "Security",
      roadmap: "Audits",
      docs: "Documentation",
      community: "Community",
    },
  },

  // Terminal — header
  header: {
    terminal: "RSTN Terminal",
    stats: {
      tps: "Target TPS",
      finality: "Finality",
      validators: "Target validators",
      pqSecurity: "PQ Security",
    },
  },

  // Landing — animations
  animations: {
    arch: {
      p2p: "P2P Network",
      apps: "Applications",
      flow: "Transaction flow",
      active: "active",
      components: "{{n}} components",
    },
    globe: {
      propagation: "Block propagation · Gossip protocol",
      validators: "Validators (testnet)",
      continents: "Continents (target)",
      finality: "Finality",
    },
    refuge: {
      vulnerableChains: "Vulnerable Chains",
      breakableByShor: "ECDSA / Ed25519 — breakable by Shor",
      refuge: "RSTN · Refuge",
      shorResistant: "Dilithium3 — Shor resistant",
      lockBurn: "Lock / Burn",
      lightClient: "Light client verify",
      quantumThreat: "Quantum computer → breaks key → steals capital",
      chainUsesSig: "{{chain}} uses {{sig}}",
      backed: "w{{chain}} backed 1:1",
      nothingToSteal: "ECDSA key broken → nothing to steal",
      phaseVulnerable: "Vulnerable",
      phaseLockBurn: "Lock / Burn + verify",
      phaseRefuge: "Secure refuge",
      phase1Threat: "Phase 1 — Threat: {{chain}} with {{sig}}",
      phase2Lock: "Phase 2 — Lock/Burn: locked + light client",
      phase3Refuge: "Phase 3 — Refuge: w{{chain}} with Dilithium3 · 1:1",
      alsoVulnerable: "Also vulnerable — all use ECDSA or Ed25519",
      pctNoProtection:
        "99% of blockchains with real value today have NO post-quantum protection",
      shorBounces: "Shor bounces",
    },
    tokenomics: {
      distribution: "Supply Distribution",
      fairLaunch: "Fair launch · No pre-sale",
      deflation: "Scarcity mechanism · Halving every 4 years",
      burnFees: "Burn 50% fees",
      hardCap: "Hard cap 1B",
      genesis: "Genesis",
      year24: "Year 24+",
      deflationarySupply: "Decreasing Supply",
    },
    flow: {
      wallet: "Wallet",
      walletSub: "Dilithium3 signature",
      mempool: "Mempool",
      mempoolSub: "Tx pending",
      propose: "Propose",
      proposeSub: "Leader creates block",
      vote: "Vote",
      voteSub: "BFT 2/3+",
      finality: "Finality",
      finalitySub: "0.4s confirmation",
      stage: "Stage {{n}}/{{total}} — {{label}}: {{sub}}",
      finalityLabel: "Finality",
      pqSignature: "PQ Signature",
      consensus: "Consensus",
    },
    timeline: {
      title: "Quantum Threat Timeline",
      heading: "The Quantum Countdown",
      description:
        "While traditional blockchains approach the quantum cliff, RSTN is born protected. Each milestone shows how quantum computing erodes classical security — and why Dilithium3 (NIST FIPS 204) is the only real defense.",
      safe: "Safe",
      warning: "Vulnerable",
      critical: "Critical",
      broken: "Compromised",
    },
  },

  // Terminal — view meta
  views: {
    onboarding: {
      title: "Onboarding Guides",
      subtitle:
        "Learn to use Resistance Network step by step: wallet, staking, bridge and quantum migration",
    },
    overview: {
      title: "Network Status",
      subtitle: "Operational metrics, system health and recent blocks",
    },
    architecture: {
      title: "Architecture",
      subtitle: "7 protocol layers and security surfaces",
    },
    cryptography: {
      title: "Post-Quantum Cryptography",
      subtitle: "Cryptographic suite, schemes and PQ coverage",
    },
    consensus: {
      title: "Consensus",
      subtitle: "BFT + DAG hybrid, dynamic sharding and deterministic finality",
    },
    nodes: {
      title: "Nodes",
      subtitle: "RSTN node architecture in Rust — 100% sovereign",
    },
    mining: {
      title: "Mining & Participation",
      subtitle: "Post-quantum PoS — no GPUs, no ASICs, no energy waste",
    },
    roadmap: {
      title: "Audits & Bug Bounty",
      subtitle: "Security, audits and rewards program",
    },
    tokenomics: {
      title: "Tokenomics",
      subtitle: "Staking, governance, monetary policy and RSTN utility",
    },
    tokenomicsView: {
      statToken: "Token",
      statHardCap: "Hard Cap",
      statMinting: "Minting",
      statMintingVal: "Zero",
      statBurn: "Burn rate",
      statBurnVal: "50% gas",
      verifiedBadge: "Quantum Verified",
      distributionTitle: "Supply Distribution",
      distributionSub: "Fair launch · No pre-sale · Verified on-chain",
      hardCapImmutable: "Immutable Hard Cap",
      metricHardCap: "HARD CAP",
      metricMinStake: "MIN STAKE",
      metricApr: "APR",
      metricFairLaunch: "FAIR LAUNCH",
      popTitle: "Proof of Participation — Distribution Without Sale",
      popDesc:
        "95% of supply is distributed without a sale. You contribute real work → you receive RSTN. The team has no reserved bucket — it earns from staking by operating the genesis validator (Satoshi model). Zero ecosystem fund, zero genesis treasury: 95% earned by work, 5% testnet bootstrap seed.",
      popHowTitle: "How it works",
      popAntiWhaleTitle: "Anti-Whale",
      popFairTitle: "Fair Distribution",
      genesisTitle: "Genesis Block — Exact Distribution Without ICO",
      genesisDesc:
        "1,000,000,000 RSTN exist from block 0. None are created. None are sold. This is how they are distributed.",
      genesisAuditTitle: "Genesis Auditability",
      genesisNoIcoTitle: "No ICO — No Sale",
      genesisNoIcoBody:
        "The genesis sells tokens to no one. Tokens are allocated by work (Proof of Participation) and governance. There is no initial sale, no sale price, no buyer, and no team allocation — the team earns from staking by operating the genesis validator (Satoshi model).",
      stakingTitle: "Staking & Governance Model",
      stakingDesc:
        "Operational parameters for staking, delegation and on-chain governance.",
      stakingStaking: "Staking",
      stakingStakingBody:
        "Native liquid staking. Validators require a minimum of 32,000 RSTN. Delegation from 1 RSTN. Rewards {{x}} based on network performance. Proportional non-destructive slashing.",
      stakingMinStake: "Min stake",
      stakingDelegation: "Delegation",
      stakingRewards: "Rewards",
      stakingUnbonding: "Unbonding",
      stakingUnbondingVal: "1 epoch",
      stakingRewardsVal: "Variable",
      stakingGovernance: "Governance",
      stakingGovernanceBody:
        "Quadratic voting with verified identity. 1 vote = 1 token². Capture threshold: 51% of verified identities, not 51% of tokens. Minority veto for critical changes.",
      stakingVoting: "Voting",
      stakingVotingVal: "Quadratic",
      stakingThreshold: "Threshold",
      stakingThresholdVal: "51% IDs",
      stakingMonetary: "Monetary Policy",
      stakingMonetaryBody:
        "Hard cap of 1B RSTN. Zero minting. 50% gas burn. Reserve with halving every 4 years. Validators earn 30% fees + reserve distribution.",
      stakingBurn: "Burn",
      stakingValidators: "Validators",
      stakingTreasury: "Security Reserve",
      stakingMinting: "Minting",
      monetaryTitle: "Monetary Policy — Hard Cap + Halving + Burn",
      monetaryDesc:
        "Zero minting. Fixed supply of 1B RSTN. 50% gas burn. Reserve distribution with halving every 4 years.",
      monetaryFeeSplitTitle: "Fee Split",
      monetaryFeeBurn: "Burn (destroyed)",
      monetaryFeeValidators: "Validators",
      monetaryFeeTreasury: "Security Reserve",
      monetaryFeeSplitBody:
        "Each transaction burns 50% of gas. Validators earn 30% + reserve distribution. Two income sources sustain security.",
      monetaryHalvingTitle: "Reserve Halving",
      monetaryHalvingBody:
        "950M RSTN of reserve is distributed to stakers with halving every 4 years. Converges to 0% in ~24 years (6 halvings). Afterwards the network becomes deflationary: the 50% gas burn exceeds the remaining emission.",
      monetaryZeroMintTitle: "Zero Minting",
      monetaryZeroMintHardCap: "Hard Cap: 1,000,000,000 RSTN",
      monetaryZeroMintHardCapBody:
        "Fixed. Never exceeded. All tokens exist from genesis.",
      monetaryZeroMintMint: "Minting: 0%",
      monetaryZeroMintMintBody:
        "No new tokens are created. The reserve is distributed, not minted.",
      monetaryZeroMintBurn: "Permanent burn",
      monetaryZeroMintBurnBody:
        "50% of gas destroyed per tx. When burn > distribution → decreasing supply.",
      ossTitle: "Open-Source & Disclaimer",
      ossDesc:
        "Resistance Network is free software. The protocol exists as open source, auditable by anyone.",
      ossLicenseTitle: "Apache 2.0 License",
      ossRepoLabel: "Repository: ",
      ossRepoVal: "To be announced",
      ossPatentLabel: "Defensive patent: ",
      ossDisclaimerTitle: "Disclaimer",
      utilityTitle: "RSTN Token Utility",
      utilityDesc:
        "RSTN is not a speculative asset. It has four real cryptographic functions in the protocol.",
    },
    explorer: {
      title: "Block Explorer",
      subtitle: "Blocks, transactions and validators — testnet preview",
    },
    docs: {
      title: "Documentation",
      subtitle:
        "SDK, JSON-RPC API and guides for node operators and dApp developers",
    },
    staking: {
      title: "Staking + Wallet",
      subtitle: "Delegate, on-chain governance and claim rewards",
    },
    security: {
      title: "Cybersecurity",
      subtitle: "8 attack domains, full team and incident response",
    },
    bridge: {
      title: "Bridges & Migration",
      subtitle:
        "Cross-chain, Quantum Migration Program and post-quantum interoperability",
    },
    dex: {
      title: "DEX · Price Discovery Pool",
      subtitle:
        "wRSTN/USDC AMM — RSTN price is born from the first swap, not a sale (Satoshi model)",
    },
    faucet: {
      title: "Testnet Faucet",
      subtitle: "Claim testnet RSTN for development and testing",
    },
    contracts: {
      title: "Smart Contracts Console",
      subtitle:
        "Deploy, call and inspect contracts on the RstnVM with post-quantum opcodes",
    },
    transparency: {
      title: "Transparency Dashboard",
      subtitle:
        "Bridge volume, fees, buyback & burn and decreasing supply — verifiable on-chain",
    },
    network: {
      title: "Network Visualizer",
      subtitle:
        "Live P2P topology: nodes, shards, gossip and latency in real time",
      topologyTitle: "Real-Time P2P Topology",
      topologyDesc:
        "Live visualization of the decentralized network: 64 shards, gossip nodes, latency and block propagation.",
      legendActive: "Active Shard",
      legendSyncing: "Syncing",
      legendBeacon: "Beacon Node",
      legendGossip: "Gossip Link",
      legendCrossShard: "Cross-Shard Commit",
      phase_propose: "Propose",
      phase_prepare: "Prepare",
      phase_commit: "Commit",
      bftRound: "BFT consensus round",
      phaseProgress: "{{pct}}% round progress",
      node: "Node #{{id}} · Shard {{shard}}",
      latency: "Latency: {{ms}}ms · Status: active",
      validators: "Validators",
      tps: "Current TPS",
      shards: "Shards",
      finality: "Finality",
      transportTitle: "P2P Transport Layers",
      transportDesc:
        "libp2p with hybrid post-quantum encryption. Every node-to-node connection is protected.",
      l4Layer: "L4 — Transport",
      l4Desc: "Stream multiplexing, 0-RTT, NAT mobility.",
      l3Layer: "L3 — Security",
      l3Desc:
        "Hybrid post-quantum handshake. If X25519 is broken, Kyber holds.",
      l2Layer: "L2 — Gossip",
      l2Tech2: "Topics: blocks, txs, consensus, votes",
      l2Desc: "Block and transaction propagation with peer scoring.",
      l1Layer: "L1 — Discovery",
      l1Desc: "3 bootstrapping mechanisms. No single point of failure.",
      metricsTitle: "Live Network Metrics",
      metricsDesc: "Key operational indicators of the RSTN network.",
      mBlockHeight: "Current block height",
      mTpsSustained: "Sustained TPS",
      mLatency: "Average latency",
      mFinality: "Deterministic finality",
      mNodesTotal: "Total nodes (target)",
      mShardsActive: "Active shards",
      mTransport: "P2P Transport",
      mTxCost: "Cost per transaction",
      shardsUnit: "shards",
      shardUnit: "shard",
      shardDistTitle: "Shard Distribution",
      shardDistDesc:
        "64 shards with cross-shard commit finality. Each shard processes 2,048 TPS independently.",
      activeNodes: "active nodes",
      crossShardTitle: "Cross-Shard Communication",
      crossShardDesc:
        "Shards are not isolated. The BFT+DAG protocol enables cross-shard commits in 1 finality round (0.4s). Transactions touching multiple shards use atomic commits with on-chain verifiable Merkle proofs.",
      tagCrossShard: "Cross-shard: 0.4s",
      tagAtomic: "Atomic commits",
      tagMerkle: "Merkle proofs",
      tagNoLock: "No global lock",
    },
  },
};

export default en;
