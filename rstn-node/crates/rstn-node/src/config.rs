//! Node configuration loaded from TOML or CLI args.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct NodeConfig {
    pub chain_id: u64,
    pub rpc_port: u16,
    pub p2p_port: u16,
    pub data_dir: String,
    pub dev_mode: bool,
    pub bootstrap_peers: Vec<String>,
}

impl Default for NodeConfig {
    fn default() -> Self {
        Self {
            chain_id: 1,
            rpc_port: 9944,
            p2p_port: 9945,
            data_dir: "./rstn-data".into(),
            dev_mode: false,
            bootstrap_peers: Vec::new(),
        }
    }
}
