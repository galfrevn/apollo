FROM docker.io/cloudflare/sandbox:0.12.4-python

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://opencode.ai/install \
  | VERSION=1.18.16 OPENCODE_INSTALL_DIR=/usr/local/bin bash \
  && opencode --version

EXPOSE 8080
