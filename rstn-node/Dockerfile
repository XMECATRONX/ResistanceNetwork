# RSTN Node Dockerfile
# Multi-stage build for minimal production image
#
# Build:  docker build -t rstn-node:latest -f Dockerfile .
# Run:    docker run -p 9944:9944 -p 9945:9945 rstn-node:latest --dev --port 9944

FROM rust:1.82-slim AS builder

WORKDIR /build

# Cache deps first (faster rebuilds when only source changes)
COPY Cargo.toml ./
COPY crates/ ./crates/

# Build release binary. The workspace [[bin]] name is `rstn-node`
# (see crates/rstn-node/Cargo.toml), so the artifact is target/release/rstn-node.
RUN cargo build --release

# -- Runtime stage --
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from builder (name is rstn-node, NOT qrp-node)
COPY --from=builder /build/target/release/rstn-node /usr/local/bin/rstn-node

# Default ports: 9944 RPC, 9945 P2P
EXPOSE 9944 9945

# Default to dev mode (single-node, auto-blocks) so `docker run` works out of
# the box. For a multi-node testnet use docker-compose.yml which passes
# --genesis + --validator-index per node.
ENTRYPOINT ["rstn-node"]
CMD ["--dev", "--port", "9944", "--p2p-port", "9945"]
