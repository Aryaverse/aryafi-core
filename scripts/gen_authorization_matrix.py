#!/usr/bin/env python3
# Copyright (c) 2026 Aryaverse. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
"""Regenerate docs/security/AUTHORIZATION_MATRIX.md from the Daml source.

Scans every template in daml/src/AryaFi/{Common,Finance,Contracts,Compliance}
for its signatory, observer, choice, and controller declarations and the first
sentence of each choice's doc comment.

Usage: python3 scripts/gen_authorization_matrix.py
"""
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(REPO, "daml", "src", "AryaFi")
OUTPUT = os.path.join(REPO, "docs", "security", "AUTHORIZATION_MATRIX.md")
SECTIONS = [
    ("Common", "Common (Audit Events)"),
    ("Finance", "Finance Primitives"),
    ("Contracts", "Financial Contracts"),
    ("Compliance", "Compliance Policies"),
]

# Readable forms of the party expressions used in signatory/observer/controller clauses.
REWRITES = [
    (r"\(List\.dedup \((.*)\)\)", r"\1"),
    (r"List\.dedup ", ""),
    (re.escape("optional [] (\\a -> [a]) agentBank"), "agentBank (if set)"),
    (re.escape("optional [] (\\t -> [t]) tripartyAgent"), "tripartyAgent (if set)"),
    (re.escape("optionalToList lockHolder"), "lockHolder (while locked)"),
    (re.escape("fromOptional owner lockHolder"), "lockHolder"),
    (re.escape("(case agentObserver of None -> []; Some a -> [a])"), "agentObserver (if set)"),
    (r"\s*::\s*", ", "),
    (r"\s*\+\+\s*", ", "),
]


def clean(expr):
    expr = expr.strip()
    for pattern, repl in REWRITES:
        expr = re.sub(pattern, repl, expr)
    expr = expr.strip()
    if expr.startswith("(") and expr.endswith(")"):
        expr = expr[1:-1].strip()
    return expr


def first_sentence(doc_lines):
    text = " ".join(doc_lines).replace("e.g. ", "e.g. ").replace("i.e. ", "i.e. ")
    return text.split(". ")[0].strip().rstrip(".").replace(" ", " ").replace("|", "/")


def doc_above(lines, i):
    doc, j = [], i - 1
    while j >= 0 and lines[j].strip().startswith("--"):
        doc.insert(0, re.sub(r"^\s*--\s?\|?\s?", "", lines[j]))
        j -= 1
    return doc


def block(lines, i, indent):
    """The lines after line i that are indented by more than `indent` spaces."""
    body = []
    for line in lines[i + 1:]:
        if line.strip() and len(line) - len(line.lstrip()) <= indent:
            break
        body.append(line)
    return body


# How an interface choice implementation checks its `actors` argument.
ACTOR_CHECKS = [
    (re.compile(r"sameParties arg\.actors ([\w.]+)"), lambda m: f"exactly {m.group(1)}"),
    (re.compile(r"all \(`elem` arg\.actors\) ([\w.]+)"), lambda m: f"all of {m.group(1)}"),
    (re.compile(r"\b(\w+) `elem` arg\.actors"), lambda m: m.group(1)),
]


def actor_checks(lines):
    """The parties that `require` lines demand among the actors, in order."""
    found = []
    for line in lines:
        if "require" not in line:
            continue
        matches = sorted((m.start(), describe(m)) for pattern, describe in ACTOR_CHECKS for m in pattern.finditer(line))
        found += [text for _, text in matches if text not in found]
    return found


def required_actor(lines, body):
    """Who an interface choice implementation requires among `actors`, looked
    up in its body or in a top-level function of the same file it calls."""
    found = actor_checks(body)
    if found:
        return found
    functions = {m.group(1): k for k, l in enumerate(lines) for m in [re.match(r"^(\w+) [^:]*=", l)] if m}
    for name, k in functions.items():
        if any(re.search(rf"\b{name}\b", line) for line in body):
            found = actor_checks(block(lines, k, 0))
            if found:
                return found
    return []


def describe_actors(found):
    if not found:
        return "actors"
    if len(found) == 1 and found[0].startswith("exactly "):
        return f"actors: {found[0]}"
    return "actors, including " + " and ".join(found)


def parse(path):
    lines = open(path).read().split("\n")
    templates, cur, interface = [], None, None
    for i, line in enumerate(lines):
        m = re.match(r"^template (\w+)", line)
        if m:
            cur = {"name": m.group(1), "signatory": "", "observer": "", "choices": []}
            templates.append(cur)
            interface = None
            continue
        if cur is None:
            continue
        m = re.match(r"^    interface instance (\S+) for \w+ where", line)
        if m:
            interface = m.group(1)
            continue
        if re.match(r"^    \S", line):
            interface = None
        # A token-standard interface choice: its controllers are the `actors`
        # argument, and the implementation checks who must be among them.
        m = re.match(r"^      ([a-z]\w*)_(\w+)Impl ", line)
        if interface and m:
            choice = m.group(1)[0].upper() + m.group(1)[1:] + "_" + m.group(2)[0].upper() + m.group(2)[1:]
            actor = required_actor(lines, [line] + block(lines, i, 6))
            doc = first_sentence(doc_above(lines, i)) or f"Token standard `{interface}` choice"
            cur["choices"].append({
                "name": choice,
                "readonly": choice.endswith("_PublicFetch"),
                # An implementation documented as "Refused" always aborts.
                "controller": "nobody (refused)" if doc.startswith("Refused") else describe_actors(actor),
                "doc": doc,
            })
            continue
        m = re.match(r"^    signatory (.+)$", line)
        if m:
            cur["signatory"] = clean(m.group(1))
            continue
        m = re.match(r"^    observer (.+)$", line)
        if m:
            cur["observer"] = clean(m.group(1))
            continue
        m = re.match(r"^    (nonconsuming )?choice (\w+)", line)
        if m:
            doc = doc_above(lines, i)
            controller = ""
            for k in range(i + 1, min(i + 25, len(lines))):
                mc = re.match(r"^      controller (.+)$", lines[k])
                if mc:
                    controller = clean(mc.group(1))
                    break
            cur["choices"].append({
                "name": m.group(2),
                "readonly": bool(m.group(1)),
                "controller": controller,
                "doc": first_sentence(doc),
            })
    return templates


def build_matrix():
    out = []
    for folder, title in SECTIONS:
        out.append(f"### {title}\n")
        out.append("| Template | Signatories | Observers | Choice | Controller(s) | Effect |")
        out.append("|:---|:---|:---|:---|:---|:---|")
        for f in sorted(os.listdir(os.path.join(ROOT, folder))):
            if not f.endswith(".daml"):
                continue
            for t in parse(os.path.join(ROOT, folder, f)):
                observers = t["observer"] or "—"
                if not t["choices"]:
                    out.append(f"| **`{t['name']}`** ({f}) | `{t['signatory']}` | `{observers}` | — | — | No choices: append-only record |")
                for n, c in enumerate(t["choices"]):
                    lead = n == 0
                    name = f"**`{t['name']}`** ({f})" if lead else ""
                    sig = f"`{t['signatory']}`" if lead else ""
                    obs = f"`{observers}`" if lead else ""
                    kind = " *(read-only)*" if c["readonly"] else ""
                    out.append(f"| {name} | {sig} | {obs} | `{c['name']}`{kind} | `{c['controller']}` | {c['doc']} |")
        out.append("")
    return "\n".join(out)


HEADER = """# AryaFi Core: Contract Authorization Matrix & Trust Boundaries

## 1. Overview & Security Model

In Daml and Canton, contract security is governed by three primitives:
1. **Signatories**: Parties whose authorization is required to create or archive a contract. Signatories are bound by the contract's terms.
2. **Controllers**: Parties who may exercise a choice. A choice body runs with the authority of the contract's signatories plus the choice's controllers.
3. **Observers**: Parties with read-only visibility of the contract and the transactions that use it.

The tables below list every template in the production modules (`daml/src/AryaFi/{Common,Finance,Contracts,Compliance}`) with its signatories, observers, choices, and controllers. They are **generated from the Daml source** by `scripts/gen_authorization_matrix.py`, so they describe what the code enforces rather than intended behaviour.

Choices of the Canton Network Token Standard interfaces (`TransferFactory_*`, `TransferInstruction_*`, `AllocationFactory_*`, `SettlementFactory_*`, `Allocation_*`) are controlled by their `actors` argument. For these, the table names the party the implementation requires among the actors.

---

## 2. Authorization Matrix (generated from source)

"""

FOOTER = """
---

## 3. Trust Boundary Principles

These principles hold for the current code and are covered by the negative and authorization tests in `daml/test/AryaFi/Test`:

1. **No position is imposed on a party without its consent.** `TransferCash`, `TransferSecurity`, and `TransferAsset` require the current owner, the holding institution (bank or custodian), and the receiving owner. The receiver becomes a signatory of the new position, so its authority is required.
2. **Token-standard transfers keep the receiver's consent.** By creating a `PositionTransferFactory`, a bank or custodian agrees in advance to transfers between its clients' accounts. The sender instructs a transfer; the receiver still signs the position it receives, either by accepting the pending `PositionTransferInstruction` or by instructing the transfer together with the sender. Until then the amount stays in the sender's account, locked to the registry.
3. **Token-standard settlement needs both sides' allocations.** A registry's `SettlementFactory_SettleBatch` settles only when the allocations authorize exactly both sides of every leg, and only for the settlement's executors; a single allocation cannot be settled on its own. Each allocation is signed by its account owner, so a receiver signs the position it receives through its own allocation. Funding stays locked to the registry until settlement, cancellation by the executors, or withdrawal by the owner (for a committed allocation, only after its settlement deadline).
4. **Locks bind to a named lock holder.** `LockCash` / `LockSecurity` / `LockAsset` are authorized by owner and bank/custodian and name a lock holder. Only the lock holder can release the lock, or deliver the position to a receiver who co-authorizes (`SettleLockedCash` / `SettleLockedSecurity`). Neither owner nor custodian can withdraw a leg from an agreed settlement.
5. **Atomic DvP.** `ExecuteDvpSettlement` validates both locked legs against the instruction (owner, account, ISIN, quantity, currency, amount, lock holder, lock reference) and delivers both in one transaction. The settlement agent cannot change economic terms; the instruction is signed by seller and buyer.
6. **No party reduces its own obligation.** Loan repayments and interest payments are recorded by the lender; loan interest is computed from rate, day count, and ledger time; securities-lending fees need both counterparties to accrue and the lender to confirm payment; margin fulfilment needs the caller to confirm receipt; collateral release on a securities return is capped pro rata.
7. **Disclosure of bilateral agreements needs both counterparties.** Adding an observer to a loan, repo, securities loan, margin call, pledge, or collateral position requires both principals.
8. **Timestamps come from the ledger.** KYC verification, sanctions screening, pledge enforcement, redemption settlement, and report amendments record ledger time rather than a caller-supplied value.
9. **Compliance officers cannot move value.** Their choices only approve, reject, or evaluate; they hold no controller rights over positions.

## 4. Known Gaps (see `docs/KNOWN_LIMITATIONS.md`)

- Multi-signatory contracts are created with multi-party submission. Across separate Canton participants this requires propose/accept workflows, which the library does not provide yet.
- Policy evaluation choices (`IsKycValid`, `IsSanctionsClear`, `EvaluateEligibility`, `EvaluateTransfer`, `CheckOwnershipLimit`) are controlled by the policy owner only, so business workflows cannot call them inside their own transactions.
- Loans, repos, pledges, collateral, and margin calls reference assets and payments by text reference rather than contract ID, so the ledger does not prevent one asset being referenced by several agreements.

## 5. Regenerating This Matrix

Update the choice doc comments in the Daml source, then run `python3 scripts/gen_authorization_matrix.py`. Do not edit the tables by hand.
"""


def main():
    with open(OUTPUT, "w") as fh:
        fh.write(HEADER + build_matrix() + FOOTER)
    print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    main()
