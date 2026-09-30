# Testing AryaFi Core on the Canton Network TestNet

This folder runs a small end-to-end test of AryaFi Core on a participant connected to the Canton Network **TestNet**, the public test deployment of the Global Synchronizer. The same script works on DevNet or any Canton 3 participant.

**Status:** ready to run. It has been rehearsed against a local Canton 3.5.19 participant with JWT authentication, and CI runs it against the `deploy/` topology. It has **not** yet been run on TestNet, because that needs a TestNet validator node (section 2).

---

## 1. Compatibility

| | TestNet (checked 2026-09-30) | AryaFi Core 3.0.0 |
|:---|:---|:---|
| Network software | Splice 0.8.3 | — |
| Canton | 3.5.18 | built and tested with Canton 3.5.19 |
| Daml SDK | 3.5.2 (Splice's own packages) | 3.5.12, Daml-LF 2.2 |

Splice's documentation states that packages built with a Daml SDK of the same major and minor version as the network's Canton (3.5) are compatible. TestNet is upgraded regularly and reset every six months, so check the current version in the [TestNet documentation](https://docs.test.global.canton.network.sync.global/app_dev/overview/version_information.html) before a run.

## 2. What You Need First

These steps are outside this repository and take time to arrange.

1. **A validator node on TestNet.** Either run your own Splice validator (Docker Compose or Helm, at the Splice version TestNet runs) or use a node-as-a-service provider. To run your own:
   - a sponsoring Super Validator issues an onboarding secret;
   - the node's single egress IP must be allowlisted by the Super Validators;
   - a TestNet validator must be approved by the Canton Foundation's tokenomics committee or added at the discretion of an approved operator.
2. **Network access to the validator's participant Ledger API** from where you run the test: the gRPC Ledger API, and preferably the JSON Ledger API. Validator deployments do not expose these publicly by default, so use a VPN, an internal network, or a port-forward.
3. **A Ledger API user with `ParticipantAdmin`**, such as the validator operator's user, and a way to get a JWT for it from the node's identity provider. Canton rejects tokens whose lifetime exceeds the participant's maximum, so request a fresh, short-lived token just before the run.
4. **Traffic.** Every transaction and party allocation on the Global Synchronizer uses traffic, which the validator buys with Canton Coin. The smoke test is small: five party allocations, about ten transactions, and vetting one package.
5. **Tools.** `dpm` with Daml SDK 3.5.12, Java 17 or 21, and a clone of this repository in a path without spaces (see the README). Build with `dpm build --all`.

## 3. Run the Smoke Test

```bash
dpm build --all

export LEDGER_HOST=participant.example.internal   # gRPC Ledger API of your validator's participant
export LEDGER_PORT=5001
export JSON_API_URL=https://json-api.example.internal   # JSON Ledger API: uploads only the production DAR
export USER_ID=administrator                      # Ledger API user with ParticipantAdmin
export ACCESS_TOKEN_FILE=token.jwt                # fresh JWT for USER_ID
export TLS=true                                   # if the gRPC Ledger API uses TLS; CACRT=ca.crt for a private CA

deploy/testnet/smoke-test.sh
```

The script:
1. prints the participant's Canton version and uploads and vets the `aryafi-core` DAR through the JSON Ledger API (only the production package goes on the network);
2. allocates five parties named `<Role>-SMOKE-<RUN_ID>` and grants `USER_ID` the right to act as them;
3. issues a bond and cash, locks both legs to the settlement agent, checks that the seller cannot take its bond back, settles the DvP atomically, and checks that both legs changed hands.

It exits with status 0 when every check passes. Each run needs a new `RUN_ID`; the default is the current UTC time. Set `SKIP_UPLOAD=true` once the DAR is on the participant.

## 4. What Is Permanent on TestNet

- **The package name.** Once `aryafi-core` 3.0.0 is vetted on your participant, every later `aryafi-core` version uploaded there must pass Canton's upgrade checks against it. An incompatible change needs a new package name or a fresh participant.
- **Parties and contracts** stay until the next TestNet reset. They are hosted only on your participant; other nodes do not receive the contracts.

## 5. What This Does Not Test

- **Cross-participant workflows.** All five parties are hosted on one participant. Parties on different participants need propose/accept workflows, which the library does not provide yet (see [KNOWN_LIMITATIONS.md §4](../../docs/KNOWN_LIMITATIONS.md#4-multi-party-workflows-and-compliance)).
- **The Canton Network token standard (CIP-56).** AryaFi holdings do not implement it yet (Improvement Plan, Workstream 1).
- **Your identity provider and TLS.** The rehearsal used an HMAC-signed token without TLS; the first TestNet run is the first test of your node's OIDC tokens and TLS setup.

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|:---|:---|:---|
| `UNAUTHENTICATED`; the participant log says `token lifetime ... too long` | The token expires later than the participant allows | Request a shorter-lived token |
| `UNAUTHENTICATED` without that message | Expired token, or one for a different participant or audience | Get a fresh token for this participant |
| `PERMISSION_DENIED` on the DAR upload or party allocation | `USER_ID` lacks `ParticipantAdmin` | Use the validator operator's user |
| `PERMISSION_DENIED` on the first submission | `USER_ID` is not the token's user, so the rights went to another user | Set `USER_ID` to the token's subject |
| `KNOWN_PACKAGE_VERSION` on upload | A different build of `aryafi-core` 3.0.0 is already vetted | Build from the same release tag, or use a new version |
| `Party already exists` | `RUN_ID` reused on this participant | Use a new `RUN_ID` |
