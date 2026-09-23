# Copyright (c) 2026 Aryaverse. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

FROM digitalasset/canton-open-source:3.0.0

LABEL maintainer="Aryaverse Core Engineering <core@aryaverse.io>"
LABEL description="AryaFi Canton Sandbox Node Container"

USER root

# Install essential runtime tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    jq \
    postgresql-client \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /canton

# Copy configuration and bootstrap scripts
COPY deploy/canton/canton.conf /canton/config/canton.conf
COPY deploy/docker/bootstrap.sh /canton/scripts/bootstrap.sh

RUN chmod +x /canton/scripts/bootstrap.sh

EXPOSE 5018 5019 10012 10022 10032 10042 10052

ENTRYPOINT ["/canton/scripts/bootstrap.sh"]
