#!/usr/bin/env bash
# Copyright (c) 2026 Aryaverse. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

echo "================================================================="
echo " Starting AryaFi Multi-Participant Canton Cluster"
echo " Protocol Version: 30 | Canton Engine: 3.0.0"
echo "================================================================="

CANTON_CONF="/canton/config/canton.conf"
BOOTSTRAP_SCRIPT="/tmp/canton_bootstrap.canton"

cat << 'EOF' > "$BOOTSTRAP_SCRIPT"
println("Connecting all participant nodes to aryafi_domain...")

// Connect participants to the shared synchronization domain
val domain = domains.aryafi_domain
participants.bank_node.domains.connect_local(domain)
participants.custodian_node.domains.connect_local(domain)
participants.dealer_a_node.domains.connect_local(domain)
participants.dealer_b_node.domains.connect_local(domain)
participants.regulator_node.domains.connect_local(domain)

println("Allocating institutional parties across nodes...")
val bankParty      = participants.bank_node.parties.enable("FederalReserveBank")
val custodianParty = participants.custodian_node.parties.enable("GlobalCustodian")
val dealerAParty   = participants.dealer_a_node.parties.enable("DealerBankA")
val dealerBParty   = participants.dealer_b_node.parties.enable("DealerBankB")
val regulatorParty = participants.regulator_node.parties.enable("SECRegulator")

println(s"Parties allocated successfully:")
println(s"  - Bank:      ${bankParty}")
println(s"  - Custodian: ${custodianParty}")
println(s"  - Dealer A:  ${dealerAParty}")
println(s"  - Dealer B:  ${dealerBParty}")
println(s"  - Regulator: ${regulatorParty}")

// Upload DAR file if present
val darPath = "/canton/dars/aryafi-core.dar"
val darFile = new java.io.File(darPath)
if (darFile.exists()) {
  println(s"Uploading ${darPath} to all participant nodes...")
  participants.all.dars.upload(darPath)
  println("DAR upload complete across all nodes.")
} else {
  println(s"Notice: ${darPath} not found mounted. Skipping initial DAR upload.")
}

println("=================================================================")
println(" AryaFi Canton Cluster Ready for Transaction Processing")
echo "  Bank Ledger API:      localhost:10012"
echo "  Custodian Ledger API: localhost:10022"
echo "  Dealer A Ledger API:  localhost:10032"
echo "  Dealer B Ledger API:  localhost:10042"
echo "  Regulator Ledger API: localhost:10052"
println("=================================================================")
EOF

# Launch Canton daemon with configuration and bootstrap script
exec bin/canton daemon -c "$CANTON_CONF" --bootstrap "$BOOTSTRAP_SCRIPT"
