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
echo " Canton 3.5 (open source) | Daml SDK 3.5"
echo "================================================================="

# The Canton console script below is Scala, not shell.
cat << EOF > "$BOOTSTRAP_SCRIPT"
nodes.local.start()

println("Creating synchronizer aryafi...")
bootstrap.synchronizer(
  synchronizerName = "aryafi",
  sequencers = Seq(aryafi_sequencer),
  mediators = Seq(aryafi_mediator),
  synchronizerOwners = Seq(aryafi_sequencer),
  synchronizerThreshold = PositiveInt.one,
  staticSynchronizerParameters = StaticSynchronizerParameters.defaultsWithoutKMS(ProtocolVersion.forSynchronizer),
)
println(s"Protocol version: \${ProtocolVersion.forSynchronizer}")

println("Connecting all participant nodes to aryafi...")
participants.local.foreach(_.synchronizers.connect_local(aryafi_sequencer, alias = "aryafi"))

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

// Upload every DAR found in the mounted directory (dpm build output).
val darDir = new java.io.File("$DAR_DIR")
val dars = Option(darDir.listFiles()).toList.flatten.filter(_.getName.endsWith(".dar")).sortBy(_.getName)
if (dars.isEmpty) {
  println("Notice: no .dar found in $DAR_DIR (run 'dpm build --all' first). Skipping DAR upload.")
} else {
  dars.foreach { dar =>
    println(s"Uploading \${dar.getName} to all participant nodes...")
    participants.local.foreach(_.dars.upload(dar.getPath))
  }
  println("DAR upload complete across all nodes.")
}

println("=================================================================")
println(" AryaFi Canton Cluster Ready")
println("                 gRPC Ledger API    JSON Ledger API")
println("  Bank:          localhost:10012    http://localhost:10013")
println("  Custodian:     localhost:10022    http://localhost:10023")
println("  Dealer A:      localhost:10032    http://localhost:10033")
println("  Dealer B:      localhost:10042    http://localhost:10043")
println("  Regulator:     localhost:10052    http://localhost:10053")
println("=================================================================")
EOF

# Launch Canton daemon with configuration and bootstrap script
exec "$CANTON_HOME/bin/canton" daemon -c "$CANTON_CONF" --bootstrap "$BOOTSTRAP_SCRIPT"
