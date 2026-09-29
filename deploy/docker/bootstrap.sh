#!/usr/bin/env bash
# Copyright (c) 2026 Aryaverse. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

CANTON_HOME="${CANTON_HOME:-/canton}"
CANTON_CONF="${CANTON_CONF:-$CANTON_HOME/config/canton.conf}"
DAR_DIR="${DAR_DIR:-$CANTON_HOME/dars}"
BOOTSTRAP_SCRIPT="${BOOTSTRAP_SCRIPT:-/tmp/canton_bootstrap.canton}"

echo "================================================================="
echo " Starting AryaFi Multi-Participant Canton Cluster"
echo " Canton 2.10 (open source) | Daml SDK 2.10.0"
echo "================================================================="

# The Canton console script below is Scala, not shell.
cat << EOF > "$BOOTSTRAP_SCRIPT"
println("Connecting all participant nodes to aryafi_domain...")
participants.local.foreach(_.domains.connect_local(aryafi_domain))

println("Allocating institutional parties, one organization per node...")
val bankParty      = bank_node.parties.enable("CashSettlementBank")
val custodianParty = custodian_node.parties.enable("GlobalCustodian")
val dealerAParty   = dealer_a_node.parties.enable("DealerBankA")
val dealerBParty   = dealer_b_node.parties.enable("DealerBankB")
val regulatorParty = regulator_node.parties.enable("SupervisoryAuthority")

println("Parties allocated:")
println(s"  - Bank:      \${bankParty}")
println(s"  - Custodian: \${custodianParty}")
println(s"  - Dealer A:  \${dealerAParty}")
println(s"  - Dealer B:  \${dealerBParty}")
println(s"  - Regulator: \${regulatorParty}")

// Upload every DAR found in the mounted directory (daml build output).
val darDir = new java.io.File("$DAR_DIR")
val dars = Option(darDir.listFiles()).toList.flatten.filter(_.getName.endsWith(".dar"))
if (dars.isEmpty) {
  println("Notice: no .dar found in $DAR_DIR (run 'daml build' first). Skipping DAR upload.")
} else {
  dars.foreach { dar =>
    println(s"Uploading \${dar.getName} to all participant nodes...")
    participants.all.dars.upload(dar.getPath)
  }
  println("DAR upload complete across all nodes.")
}

println("=================================================================")
println(" AryaFi Canton Cluster Ready")
println("  Bank Ledger API:      localhost:10012")
println("  Custodian Ledger API: localhost:10022")
println("  Dealer A Ledger API:  localhost:10032")
println("  Dealer B Ledger API:  localhost:10042")
println("  Regulator Ledger API: localhost:10052")
println("=================================================================")
EOF

# Launch Canton daemon with configuration and bootstrap script
exec "$CANTON_HOME/bin/canton" daemon -c "$CANTON_CONF" --bootstrap "$BOOTSTRAP_SCRIPT"
