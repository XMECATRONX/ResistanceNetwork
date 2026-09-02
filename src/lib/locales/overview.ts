// Overview view translations — split from en.ts to stay under line limit.

export const overviewEn = {
  // System health chips
  sysConsensus: "Consensus",
  sysP2p: "P2P Network",
  sysStorage: "Storage",
  sysSync: "Sync",
  sysOperational: "Operational",
  sysSynced: "Synced",
  // Error
  connectError: "Could not connect to RSTN node",
  // Quick metrics
  metricThroughput: "Current throughput",
  metricActiveValidators: "Active validators",
  metricPendingTxs: "Pending txs",
  metricActiveShards: "Active shards",
  // Disclaimer
  simBadge: "Simulated data —",
  simBody:
    "RSTN is in Phase 0 (specification). The metrics shown are architectural design targets, not live data from an operational network.",
  // Network status
  netStatus: "Network Status",
  netBlock:
    "Block #{{height}} · Current epoch · Finality {{finality}} · Block every {{blockTime}}",
  // Performance panel
  perfTitle: "Network Performance",
  perfDesc: "Real-time throughput — data from the connected node",
  tpsCurrent: "Current TPS",
  tpsTarget: "Target TPS",
  avgFee: "Average fee",
  // Specs panel
  specsTitle: "Technical Specifications",
  specsDesc: "Protocol parameters",
  specBlockTime: "Block time",
  specFinality: "Finality",
  specLatency: "P2P latency",
  specTxCost: "Cost per tx",
  specEnergy: "Energy per tx",
  specStorage: "Storage",
  // Blocks panel
  blocksTitle: "Recent Blocks",
  blocksDesc: "Latest blocks produced by the network",
  blockGasUsed: "Gas used",
  blockNoRecent: "No recent blocks",
};

export const overviewEs = {
  sysConsensus: "Consenso",
  sysP2p: "Red P2P",
  sysStorage: "Almacenamiento",
  sysSync: "Sync",
  sysOperational: "Operacional",
  sysSynced: "Sincronizado",
  connectError: "No se pudo conectar al nodo RSTN",
  metricThroughput: "Throughput actual",
  metricActiveValidators: "Validadores activos",
  metricPendingTxs: "Tx pendientes",
  metricActiveShards: "Shards activos",
  simBadge: "Datos simulados —",
  simBody:
    "RSTN está en Fase 0 (especificación). Las métricas mostradas son objetivos de diseño arquitectónicos, no datos en vivo de una red operativa.",
  netStatus: "Estado de la Red",
  netBlock:
    "Bloque #{{height}} · Época actual · Finalidad {{finality}} · Bloque cada {{blockTime}}",
  perfTitle: "Rendimiento de Red",
  perfDesc: "Throughput en tiempo real — datos del nodo conectado",
  tpsCurrent: "TPS actual",
  tpsTarget: "TPS objetivo",
  avgFee: "Fee promedio",
  specsTitle: "Especificaciones Técnicas",
  specsDesc: "Parámetros del protocolo",
  specBlockTime: "Tiempo de bloque",
  specFinality: "Finalidad",
  specLatency: "Latencia P2P",
  specTxCost: "Costo por tx",
  specEnergy: "Energía por tx",
  specStorage: "Almacenamiento",
  blocksTitle: "Bloques Recientes",
  blocksDesc: "Últimos bloques producidos por la red",
  blockGasUsed: "Gas usado",
  blockNoRecent: "Sin bloques recientes",
};
