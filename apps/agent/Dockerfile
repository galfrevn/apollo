FROM docker.io/cloudflare/sandbox:0.12.4-python

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Pinned by version and checksum: the release tarball is fetched over HTTPS,
# but only a byte-for-byte match with the recorded digest reaches the image.
ARG OPENCODE_VERSION=1.18.16
ARG OPENCODE_SHA256=286e07355df06738c1905955be15b7fbc10a7b12d931de9394a6f7597246750b
RUN curl -fsSL -o /tmp/opencode.tar.gz \
  "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-linux-x64.tar.gz" \
  && echo "${OPENCODE_SHA256}  /tmp/opencode.tar.gz" | sha256sum -c - \
  && mkdir -p /tmp/opencode-dist \
  && tar -xzf /tmp/opencode.tar.gz -C /tmp/opencode-dist \
  && install -m 755 "$(find /tmp/opencode-dist -type f -name opencode | head -n 1)" /usr/local/bin/opencode \
  && rm -rf /tmp/opencode.tar.gz /tmp/opencode-dist \
  && opencode --version

EXPOSE 8080
