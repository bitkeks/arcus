FROM fedora:36

RUN dnf install -y git perl \
    rust cargo pkg-config openssl openssl-devel \
    rust-std-static-wasm32-unknown-unknown.noarch

RUN cargo install wasm-pack

ENV USER bitkeks
