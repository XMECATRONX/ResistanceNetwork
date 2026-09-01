# Resistance Smart Contracts -- Plan T?cnico Final

## Decisi?n arquitect?nica: H?brido con `revm`

**No reimplementar el EVM. No quedarse solo en protocolo nativo.**

Usar `revm` (Rust EVM crate auditado, usado por Arbitrum, Optimism, Base, Linea)
como motor de ejecuci?n de smart contracts, con precompiladas post-cu?nticas propias.

---

## Por qu? esta decisi?n

| Opci?n | Veredicto | Raz?n |
|--------|-----------|-------|
| Protocolo nativo puro (Cosmos-style) | ? Rechazada | Whitepaper promete "EVM compatible" -- incumplir?a la promesa. Sin dApps no hay ecosistema |
| EVM desde cero | ? Rechazada | 140 opcodes manuales = meses de trabajo + bugs. Innecesario |
| **H?brido con `revm`** | ? Aprobada | Est?ndar de la industria. Precompiladas PQ propias. R?pido de integrar |

---

## Arquitectura final

```
?---------------------------------------------------------?
|                    RESISTANCE NODE                            |
|                                                         |
|  ?-------------?    ?--------------?    ?------------? |
|  |  Consensus   |    |   Protocol    |    |   revm     | |
|  |  (BFT+DAG)  |---?|   Native      |    |  (EVM)     | |
|  |             |    |               |    |            | |
|  |  Propose    |    | - Staking     |    | - dApps    | |
|  |  Prepare    |    | - Governance  |    | - DeFi     | |
|  |  Commit     |    | - Bridge      |    | - NFTs     | |
|  |             |    | - Vesting     |    | - Tokens   | |
|  ?-------------?    | - Transfers   |    |            | |
|                     ?--------------?    | + PQ Pre-  | |
|                                          |   compiles | |
|                     ?--------------?    |            | |
|                     |  Storage      |?--| Database   | |
|                     |  (RocksDB)    |    | trait      | |
|                     ?--------------?    ?------------? |
|                                                         |
|  Precompiladas PQ:                                      |
|  - 0xF0: OP_VALID_SIG (Dilithium3 verification)         |
|  - 0xF5: OP_CROSS_SHARD_SEND (mensajer?a cross-shard)   |
|  - 0xF1: OP_KYBER_ENCAPS (Kyber768 encapsulation)       |
?---------------------------------------------------------?
```

### Qu? es nativo (Rust) vs qu? es smart contract (revm)

| Funci?n | Tipo | Por qu? |
|---------|------|---------|
| Transferencias | Nativo | Seguridad cr?tica -- no delegar a contrato |
| Staking | Nativo | Consenso depende de esto -- debe ser infalible |
| Gobernanza | Nativo | Reglas de consenso -- no actualizable por contrato |
| Bridge | Nativo | Maneja valor cross-chain -- m?ximo control |
| Vesting | Nativo | Asignaci?n genesis -- inmutable |
| dApps DeFi | Smart contract | Usuarios construyen -- flexibilidad necesaria |
| Tokens ERC-20 | Smart contract | Est?ndar para dApps |
| NFTs | Smart contract | Casos de uso de usuarios |
| DEX, lending, etc. | Smart contract | Ecosistema DeFi |

---

## Fases de implementaci?n

### FASE 1 -- Integrar `revm` (2-3 semanas)

#### 1.1 Agregar dependencia

```toml
# rstn-node/Cargo.toml
[workspace.dependencies]
revm = { version = "8", features = ["std", "serde"] }

# rstn-vm/Cargo.toml
[dependencies]
revm = { workspace = true }
rstn-storage = { path = "../rstn-storage" }
```

#### 1.2 Reemplazar rstn-vm con wrapper de revm

```rust
// rstn-vm/src/lib.rs (nuevo)

use revm::{
    Database, Evm, ExecutionResult,
    primitives::{Address, Bytes, TransactTo, U256, TxEnv, BlockEnv},
    DatabaseCommit, State,
};
use resist_storage::Storage;

/// Wrapper que conecta rstn-storage al trait Database de revm
pub struct RstnDb {
    storage: Storage,
}

impl Database for RstnDb {
    type Error = String;

    fn basic(&mut self, address: Address) -> Result<Option<revm::primitives::AccountInfo>, Self::Error> {
        // Leer cuenta de rstn-storage
        self.storage
            .get_account(&address.0)
            .map(|acc| acc.map(|a| revm::primitives::AccountInfo {
                balance: U256::from(a.balance),
                nonce: a.nonce,
                code_hash: a.code_hash.into(),
                code: None, // lazy load
            }))
            .map_err(|e| e.to_string())
    }

    fn code_by_hash(&mut self, code_hash: revm::primitives::B256) -> Result<Bytes, Self::Error> {
        self.storage
            .get_code(&code_hash.0)
            .map(|c| Bytes::from(c.unwrap_or_default()))
            .map_err(|e| e.to_string())
    }

    fn storage(&mut self, address: Address, index: U256) -> Result<U256, Self::Error> {
        self.storage
            .get_contract_storage(&address.0, &index.to_be_bytes_vec())
            .map(|v| U256::from_be_bytes(v.unwrap_or_default()))
            .map_err(|e| e.to_string())
    }
}

/// Ejecutar bytecode de smart contract
pub fn execute_contract(
    db: &mut RstnDb,
    caller: Address,
    to: TransactTo,
    value: U256,
    data: Bytes,
    gas_limit: u64,
) -> Result<ExecutionResult, String> {
    let mut evm = Evm::builder()
        .with_db(db)
        .with_tx_env(TxEnv {
            caller,
            transact_to: to,
            value,
            data,
            gas_limit,
            ..Default::default()
        })
        .with_block_env(BlockEnv {
            number: U256::from(resist_storage::current_block_number()),
            ..Default::default()
        })
        .build();

    evm.transact().map(|r| r.result).map_err(|e| e.to_string())
}

/// Deployar contrato nuevo
pub fn deploy_contract(
    db: &mut RstnDb,
    caller: Address,
    init_code: Bytes,
    gas_limit: u64,
) -> Result<Address, String> {
    let mut evm = Evm::builder()
        .with_db(db)
        .with_tx_env(TxEnv {
            caller,
            transact_to: TransactTo::create(),
            data: init_code,
            gas_limit,
            ..Default::default()
        })
        .build();

    let result = evm.transact().map_err(|e| e.to_string())?;
    match result.result {
        ExecutionResult::Success { output, .. } => {
            // output.address contiene la direcci?n del contrato creado
            if let revm::primitives::Output::Create(_, Some(address)) = output {
                Ok(address)
            } else {
                Err("Deployment failed: no contract address".into())
            }
        }
        _ => Err("Deployment failed".into()),
    }
}
```

#### 1.3 Registrar precompiladas PQ

```rust
// rstn-vm/src/precompiles.rs

use revm::primitives::{Bytes, Address};
use revm::precompile::{Precompile, PrecompileResult, PrecompileError};

/// 0x0000...00F0: Dilithium3 signature verification
pub fn dilithium_verify(input: Bytes) -> PrecompileResult {
    // input = [pubkey (1952 bytes)] [signature (3293 bytes)] [message (variable)]
    if input.len() < 1952 + 3293 {
        return Err(PrecompileError::Other("invalid input length".into()));
    }
    let pubkey = &input[..1952];
    let signature = &input[1952..1952 + 3293];
    let message = &input[1952 + 3293..];

    match resist_crypto::verify_dilithium3(pubkey, signature, message) {
        true => Ok(Bytes::from([0x01])),
        false => Ok(Bytes::from([0x00])),
    }
}

/// 0x0000...00F5: Cross-shard message send
pub fn cross_shard_send(input: Bytes) -> PrecompileResult {
    // input = [shard_id (1 byte)] [payload (variable)]
    if input.is_empty() {
        return Err(PrecompileError::Other("empty cross-shard message".into()));
    }
    let shard_id = input[0] as u32;
    let payload = &input[1..];

    // Enqueue cross-shard message
    resist_storage::enqueue_cross_shard_message(shard_id, payload)
        .map(|_| Bytes::from([0x01]))
        .map_err(|e| PrecompileError::Other(e.to_string()))
}

/// 0x0000...00F1: Kyber768 encapsulation
pub fn kyber_encaps(input: Bytes) -> PrecompileResult {
    // input = [public_key (1184 bytes)]
    if input.len() != 1184 {
        return Err(PrecompileError::Other("invalid Kyber public key".into()));
    }
    let (ciphertext, shared_secret) = resist_crypto::kyber_encapsulate(&input);
    // Returns: [ciphertext (1088 bytes)] [shared_secret (32 bytes)]
    Ok(Bytes::from([ciphertext, shared_secret].concat()))
}

/// Registrar todas las precompiladas
pub fn resist_precompiles() -> Vec<(Address, Precompile)> {
    vec![
        (Address::from_low_u64_be(0xF0), Precompile::Standard(dilithium_verify)),
        (Address::from_low_u64_be(0xF1), Precompile::Standard(kyber_encaps)),
        (Address::from_low_u64_be(0xF5), Precompile::Standard(cross_shard_send)),
    ]
}
```

---

### FASE 2 -- Storage y estado (1 semana)

#### 2.1 Implementar DatabaseCommit para persistir cambios

```rust
// rstn-vm/src/db.rs

impl DatabaseCommit for RstnDb {
    fn commit(&mut self, changes: revm::primitives::HashMap<Address, revm::primitives::Account>) {
        for (address, account) in changes {
            self.storage.put_account(
                &address.0,
                &resist_storage::Account {
                    balance: account.balance.to_be_bytes(),
                    nonce: account.nonce,
                    code_hash: account.code_hash.0,
                    storage_root: [0; 32], // computed on commit
                },
            ).unwrap();

            // Persistir storage changes
            for (key, value) in account.storage {
                self.storage.put_contract_storage(
                    &address.0,
                    &key.to_be_bytes_vec(),
                    &value.present_value().to_be_bytes_vec(),
                ).unwrap();
            }

            // Persistir code si existe
            if let Some(code) = account.info.code {
                self.storage.put_code(&account.info.code_hash.0, &code.original_bytes()).unwrap();
            }
        }
    }
}
```

#### 2.2 Conectar al runner

```rust
// rstn-node/src/runner.rs -- agregar a process_transaction

match tx.tx_type {
    TxType::Transfer | TxType::Stake | TxType::Unstake | ... => {
        // Protocolo nativo (existente)
    }
    TxType::ContractDeploy => {
        let mut db = RstnDb::new(storage.clone());
        let address = resist_vm::deploy_contract(
            &mut db,
            Address::from(tx.sender.0),
            Bytes::from(tx.data),
            tx.gas_limit,
        )?;
        db.commit(db.take_commit());
        // Emitir evento con la direcci?n del contrato
    }
    TxType::ContractCall => {
        let mut db = RstnDb::new(storage.clone());
        let result = resist_vm::execute_contract(
            &mut db,
            Address::from(tx.sender.0),
            TransactTo::Call(Address::from(tx.to.unwrap().0)),
            U256::from(tx.amount),
            Bytes::from(tx.data),
            tx.gas_limit,
        )?;
        db.commit(db.take_commit());
        // Procesar resultado (logs, gas usado, etc.)
    }
}
```

---

### FASE 3 -- Compilador y deploy (1 semana)

#### 3.1 Usar `solc` est?ndar

```bash
# No necesitamos compilador propio. Solidity est?ndar compila a EVM bytecode
# que revm ejecuta nativamente.

# Instalar solc
curl -L https://github.com/ethereum/solidity/releases/download/v0.8.24/solc-static-linux -o /usr/local/bin/solc
chmod +x /usr/local/bin/solc

# Compilar contrato
solc --bin --abi contracts/MyToken.sol -o build/

# Deploy via CLI
rstn-cli deploy build/MyToken.bin --shard 12 --from <address> --gas 3000000
```

#### 3.2 CLI deploy command

```rust
// rstn-node/src/main.rs -- agregar subcomando Deploy

Commands::Deploy { contract_path, shard, from, gas } => {
    let bytecode = std::fs::read(contract_path)?;
    let tx = Transaction {
        tx_type: TxType::ContractDeploy,
        sender: from,
        data: bytecode,
        gas_limit: gas,
        ..Default::default()
    };
    let tx_hash = runner.submit_transaction(tx)?;
    println!("Contract deployed. TX: {}", hex::encode(tx_hash));
    // Esperar confirmaci?n y mostrar direcci?n del contrato
}
```

---

### FASE 4 -- Contratos del protocolo (2 semanas)

#### 4.1 Contratos de ejemplo para deployar

```solidity
// contracts/ResistanceERC20.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ResistanceERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // Post-quantum signature verification via precompile
    address constant DILITHIUM_PRECOMPILE = address(0xF0);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    // Post-quantum transfer: verify Dilithium3 signature on-chain
    function transferWithPQSig(
        address to,
        uint256 amount,
        bytes calldata pubkey,
        bytes calldata signature,
        bytes calldata message
    ) external returns (bool) {
        // Call precompile at 0xF0
        (bool success, bytes memory result) = DILITHIUM_PRECOMPILE.staticcall(
            abi.encodePacked(pubkey, signature, message)
        );
        require(success && result.length == 1 && result[0] == 0x01, "Invalid PQ signature");

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
```

```solidity
// contracts/CrossShardBridge.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CrossShardBridge {
    address constant CROSS_SHARD_PRECOMPILE = address(0xF5);

    event CrossShardMessage(uint256 indexed shardId, bytes payload);

    function sendToShard(uint256 shardId, bytes calldata payload) external {
        // Call precompile at 0xF5
        (bool success,) = CROSS_SHARD_PRECOMPILE.staticcall(
            abi.encodePacked(uint8(shardId), payload)
        );
        require(success, "Cross-shard send failed");
        emit CrossShardMessage(shardId, payload);
    }
}
```

#### 4.2 Contratos a migrar (opcional, post-mainnet)

| Contrato | Actual | Migraci?n |
|----------|--------|-----------|
| Vesting | Nativo (GenesisConfig) | Opcional: contrato Solidity para flexibilidad |
| Bridge | Nativo (rstn-bridge crate) | Mantener nativo -- seguridad cr?tica |
| Staking Factory | N/A | Nuevo: permite a dApps crear pools de staking propios |
| Governance Factory | N/A | Nuevo: permite crear DAOs on-chain |

---

## Checklist de implementaci?n

### FASE 1 -- revm integration
- [ ] Agregar `revm` al workspace
- [ ] Implementar `RstnDb` (Database trait)
- [ ] Implementar precompiladas PQ (0xF0, 0xF1, 0xF5)
- [ ] Reemplazar `rstn-vm/src/lib.rs` con wrapper revm
- [ ] Tests: ejecutar bytecode simple (PUSH1 0x42, PUSH1 0x00, MSTORE, RETURN)
- [ ] Tests: deployar contrato ERC-20 b?sico
- [ ] Tests: llamar m?todo de contrato

### FASE 2 -- Storage
- [ ] Implementar `DatabaseCommit` para persistir estado
- [ ] Conectar revm Database a RocksDB
- [ ] Tests: deployar contrato, reiniciar nodo, verificar estado persistido
- [ ] Tests: SLOAD/SSTORE funcionan tras reinicio

### FASE 3 -- Compiler
- [ ] Integrar `solc` en el CLI
- [ ] Comando `rstn-cli deploy contract.sol --shard N`
- [ ] Generar ABI autom?ticamente
- [ ] Tests: compilar y deployar ERC-20

### FASE 4 -- Protocol contracts
- [ ] Contrato ERC-20 con PQ signatures
- [ ] Contrato CrossShardBridge
- [ ] Staking Factory
- [ ] Governance Factory
- [ ] Tests E2E: deployar -> llamar -> verificar estado

---

## Dependencias necesarias

```toml
# Cargo.toml (workspace)
[workspace.dependencies]
revm = { version = "8", features = ["std", "serde", "optional_balance_check"] }
rstn-crypto = { path = "crates/rstn-crypto" }

# rstn-vm/Cargo.toml
[dependencies]
revm = { workspace = true }
rstn-storage = { path = "../rstn-storage" }
rstn-crypto = { path = "../rstn-crypto" }
```

---

## Estimaci?n de tiempo

| Fase | Tiempo | Bloqueado por |
|------|--------|---------------|
| FASE 1 -- revm | 2-3 semanas | Ninguno |
| FASE 2 -- Storage | 1 semana | FASE 1 |
| FASE 3 -- Compiler | 1 semana | FASE 1 |
| FASE 4 -- Contracts | 2 semanas | FASE 2 + 3 |
| **Total** | **6-7 semanas** | |

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigaci?n |
|--------|-------------|------------|
| revm API cambia entre versiones | Media | Pin version en Cargo.toml |
| Storage trait de revm no mapea bien a RocksDB | Baja | Wrapper adapter pattern |
| Gas metering difiere de Ethereum | Media | Usar revm gas table default |
| Precompiladas PQ consumen mucho gas | Alta | Benchmark + gas cost fijo alto |
| Cross-shard messages no llegan | Media | Retry queue en storage |

---

## Conclusi?n

**Esta es la decisi?n final.** No se discute m?s. El plan es:

1. `revm` como motor EVM
2. Precompiladas PQ (Dilithium3, Kyber768, cross-shard)
3. Protocolo nativo para funciones cr?ticas (staking, governance, bridge)
4. Smart contracts para dApps de usuarios (DeFi, NFTs, tokens)
5. `solc` est?ndar como compilador
6. 6-7 semanas de trabajo para el dev backend

**El dev backend puede empezar la FASE 1 inmediatamente despu?s de que el nodo compile.**
