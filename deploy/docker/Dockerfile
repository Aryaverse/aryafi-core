# Copyright (c) 2026 Aryaverse. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

# Canton open source matching the project's Daml SDK version (daml.yaml).
# The public digitalasset/canton-open-source image stopped at 2.7.x, so the
# Canton release published with the Daml SDK is installed on a JRE base image.
FROM eclipse-temurin:17-jre

ARG CANTON_VERSION=2.10.0

LABEL maintainer="Aryaverse Core Engineering <core@aryaverse.io>"
LABEL description="AryaFi multi-participant Canton ${CANTON_VERSION} test topology"

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/canton.tar.gz \
      "https://github.com/digital-asset/daml/releases/download/v${CANTON_VERSION}/canton-open-source-${CANTON_VERSION}.tar.gz" \
    && mkdir -p /canton \
    && tar -xzf /tmp/canton.tar.gz -C /canton --strip-components=1 \
    && rm /tmp/canton.tar.gz \
    && mkdir -p /canton/config /canton/scripts /canton/dars

WORKDIR /canton

COPY deploy/canton/canton.conf /canton/config/canton.conf
COPY deploy/docker/bootstrap.sh /canton/scripts/bootstrap.sh
RUN chmod +x /canton/scripts/bootstrap.sh

EXPOSE 5018 5019 10012 10022 10032 10042 10052

ENTRYPOINT ["/canton/scripts/bootstrap.sh"]
