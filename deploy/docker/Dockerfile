# Copyright (c) 2026 Aryaverse. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

# Canton open source bundled with the project's Daml SDK (sdk-version 3.5.12 in
# daml.yaml ships Canton 3.5.19). The release tarball is installed on a JRE 21
# base image, the Java version Canton 3.5 is tested with.
FROM eclipse-temurin:21-jre

ARG CANTON_VERSION=3.5.19

LABEL maintainer="Aryaverse Core Engineering <core@aryaverse.io>"
LABEL description="AryaFi multi-participant Canton ${CANTON_VERSION} test topology"

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/canton.tar.gz \
      "https://github.com/digital-asset/canton/releases/download/v${CANTON_VERSION}/canton-open-source-${CANTON_VERSION}.tar.gz" \
    && mkdir -p /canton \
    && tar -xzf /tmp/canton.tar.gz -C /canton --strip-components=1 \
    && rm /tmp/canton.tar.gz \
    && mkdir -p /canton/config /canton/scripts /canton/dars

WORKDIR /canton

COPY deploy/canton/canton.conf /canton/config/canton.conf
COPY deploy/docker/bootstrap.sh /canton/scripts/bootstrap.sh
RUN chmod +x /canton/scripts/bootstrap.sh

EXPOSE 5018 5019 5020 10012 10013 10022 10023 10032 10033 10042 10043 10052 10053

ENTRYPOINT ["bash", "/canton/scripts/bootstrap.sh"]
