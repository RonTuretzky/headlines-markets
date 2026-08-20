import { useMemo, useState } from "react";
import { Button, Chip } from "@breadcoop/ui";
import { CheckCircle, Circle, EnvelopeSimple, UploadSimple } from "@phosphor-icons/react";
import { abis } from "../contracts/gen";
import { DKIM, Resolution, type MarketData } from "../hooks/useMarkets";
import { fmtDate, fmtDuration } from "../lib/format";
import {
  buildCompiledProof,
  buildProof,
  mockKeyHash,
  parseEml,
  type CompiledProofStruct,
  type EmailProofStruct,
  type ParsedEmail,
} from "../lib/prover";
import { publicClient, useWallet } from "../lib/wallet";
import { explain } from "./TradeWidget";

type SettleMode = "transparent" | "compiled";

interface Candidate {
  parsed: ParsedEmail;
  mode: SettleMode;
  proof: EmailProofStruct | null; // transparent mode
  compiledProof: CompiledProofStruct | null; // compiled mode
  sourceIndex: number | null; // the source whose domain matches (domains are unique per market)
  checked: { ok: boolean; reason: string } | null;
}

export function ResolutionPanel({ m }: { m: MarketData }) {
  const wallet = useWallet();
  const [mode, setMode] = useState<SettleMode>("transparent");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [settledNote, setSettledNote] = useState<string | null>(null);

  const now = Number(m.chainNow); // chain time, not wall clock (anvil can be warped)
  const noResolvableAt = Number(m.deadline) + Number(m.resolutionBuffer);
  const open = m.resolution === Resolution.Unresolved;

  const onFile = async (file: File) => {
    setFileError(null);
    setTxError(null);
    setSettledNote(null);
    setCandidate(null);
    try {
      const raw = await file.text();
      const parsed = parseEml(raw);
      const sourceIndex = m.sources.findIndex((s) => s.dkimDomain === parsed.domainName);
      if (sourceIndex < 0) {
        setCandidate({ parsed, mode, proof: null, compiledProof: null, sourceIndex: null, checked: null });
        return;
      }
      const src = m.sources[sourceIndex];
      let checked: Candidate["checked"] = null;
      if (mode === "compiled") {
        // The "circuit" evaluates the patterns locally; content never goes onchain.
        const compiledProof = buildCompiledProof(parsed, {
          fromRegex: src.fromRegex,
          contentField: m.contentField,
          contentPattern: src.contentRegex || m.contentRegex,
        });
        const [ok, reason] = (await publicClient.readContract({
          address: m.market,
          abi: abis.HeadlineMarket,
          functionName: "checkCompiledProof",
          args: [BigInt(sourceIndex), compiledProof],
        })) as [boolean, string];
        checked = { ok, reason };
        setCandidate({ parsed, mode, proof: null, compiledProof, sourceIndex, checked });
      } else {
        const proof = buildProof(parsed);
        const [ok, reason] = (await publicClient.readContract({
          address: m.market,
          abi: abis.HeadlineMarket,
          functionName: "checkProof",
          args: [BigInt(sourceIndex), proof],
        })) as [boolean, string];
        checked = { ok, reason };
        setCandidate({ parsed, mode, proof, compiledProof: null, sourceIndex, checked });
      }
    } catch (e) {
      setFileError(explain(e));
    }
  };

  const submitProof = async () => {
    if (!candidate || candidate.sourceIndex === null) return;
    setBusy("proof");
    setTxError(null);
    try {
      // Mock-mode convenience: make sure the domain's mock DKIM key is registered
      // (permissionless on the mock registry).
      const domain = candidate.parsed.domainName;
      const registered = (await publicClient.readContract({
        address: DKIM,
        abi: abis.MockDKIMRegistry,
        functionName: "isDKIMPublicKeyHashValid",
        args: [domain, mockKeyHash(domain)],
      })) as boolean;
      if (!registered) {
        await wallet.write({ address: DKIM, abi: abis.MockDKIMRegistry, functionName: "registerMockKey", args: [domain] });
      }
      await wallet.write({
        address: m.market,
        abi: abis.HeadlineMarket,
        functionName: candidate.mode === "compiled" ? "submitCompiledProof" : "submitProof",
        args: [
          BigInt(candidate.sourceIndex),
          candidate.mode === "compiled" ? candidate.compiledProof! : candidate.proof!,
        ],
      });
      setSettledNote(`Proof accepted for ${m.sources[candidate.sourceIndex].name}.`);
      setCandidate(null);
    } catch (e) {
      setTxError(explain(e));
    } finally {
      setBusy(null);
    }
  };

  const resolveNo = async () => {
    setBusy("no");
    setTxError(null);
    try {
      await wallet.write({ address: m.market, abi: abis.HeadlineMarket, functionName: "resolveNo" });
    } catch (e) {
      setTxError(explain(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bread-card p-4" data-testid="resolution-panel">
      <h3 className="mb-1 font-breadDisplay text-lg font-bold uppercase">Resolution</h3>
      <p className="mb-3 text-sm text-surface-grey-2">
        Anyone can settle this market: submit a zkEmail proof of a matching breaking-news alert email.{" "}
        {m.threshold} of {m.sources.length} sources required for YES.
      </p>

      {/* per-source status */}
      <ul className="mb-4 space-y-2" data-testid="source-status">
        {m.sources.map((s, i) => {
          const ev = m.evidence.find((e) => e.sourceIndex === i);
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              {m.sourceMatched[i] ? (
                <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-system-green" />
              ) : (
                <Circle size={18} className="mt-0.5 shrink-0 text-surface-grey" />
              )}
              <div>
                <span className="font-bold">{s.name}</span>{" "}
                <span className="text-caption text-surface-grey-2">({s.dkimDomain})</span>
                {ev && (
                  <div className="text-caption text-surface-grey-2">
                    {ev.compiled ? (
                      <em>settled by private compiled proof</em>
                    ) : (
                      <>“{ev.subject}”</>
                    )}{" "}
                    · {fmtDate(ev.emailTimestamp)} · submitted by {short(ev.submitter)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {m.resolution === Resolution.Yes && (
        <div className="border-2 border-system-green bg-[#eaf7e4] p-3 font-bold text-system-green">
          Resolved YES — threshold reached.
        </div>
      )}
      {m.resolution === Resolution.No && (
        <div className="border-2 border-system-red bg-red-0 p-3 font-bold text-system-red">
          Resolved NO — deadline passed without enough matching alerts.
        </div>
      )}

      {open && (
        <>
          <div className="mb-2 flex border-2 border-surface-ink text-sm">
            <button
              data-testid="mode-transparent"
              onClick={() => {
                setMode("transparent");
                setCandidate(null);
              }}
              className={`flex-1 px-2 py-1.5 font-bold ${
                mode === "transparent" ? "bg-surface-ink text-paper-0" : "bg-paper-0"
              }`}
            >
              Transparent proof
            </button>
            <button
              data-testid="mode-compiled"
              onClick={() => {
                setMode("compiled");
                setCandidate(null);
              }}
              className={`flex-1 px-2 py-1.5 font-bold ${
                mode === "compiled" ? "bg-surface-ink text-paper-0" : "bg-paper-0"
              }`}
            >
              Compiled proof (private, ~20x cheaper)
            </button>
          </div>
          <label
            className="flex cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-surface-ink bg-paper-1 px-3 py-6 font-bold hover:bg-paper-2"
            data-testid="eml-drop"
          >
            <UploadSimple size={20} />
            Upload a raw email (.eml) to generate a proof
            <input
              type="file"
              accept=".eml,message/rfc822,text/plain"
              className="hidden"
              data-testid="eml-input"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          <p className="mt-1 text-caption text-surface-grey-2">
            In Gmail: open the alert → ⋮ → “Show original” → Download original. The mock prover extracts the
            DKIM domain, From, Subject, Date and body — in production this runs a real zkEmail Groth16 circuit.
          </p>

          {fileError && (
            <div className="mt-2 border-2 border-system-red bg-red-0 px-2 py-1 text-caption text-system-red">
              {fileError}
            </div>
          )}

          {candidate && (
            <div className="mt-3 border-2 border-surface-ink bg-paper-0 p-3" data-testid="proof-preview">
              <div className="mb-2 flex items-center gap-2 font-bold">
                <EnvelopeSimple size={18} />
                {candidate.mode === "compiled" ? "Compiled proof (content stays private)" : "Extracted proof fields"}
              </div>
              {candidate.mode === "compiled" && (
                <p className="mb-2 text-caption text-surface-grey-2" data-testid="compiled-note">
                  The market's patterns are compiled into the circuit; the proof only certifies "a matching
                  DKIM-signed email exists". The fields below stay local — only pattern commitments go onchain.
                </p>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-surface-grey-2">DKIM domain</dt>
                <dd className="font-mono">{candidate.parsed.domainName}</dd>
                <dt className="text-surface-grey-2">From</dt>
                <dd className="font-mono">{candidate.parsed.fromAddress}</dd>
                <dt className="text-surface-grey-2">Subject</dt>
                <dd data-testid="proof-subject">{candidate.parsed.subject}</dd>
                <dt className="text-surface-grey-2">Date</dt>
                <dd>{fmtDate(candidate.parsed.timestamp)}</dd>
                <dt className="text-surface-grey-2">Nullifier</dt>
                <dd className="truncate font-mono text-caption">{candidate.parsed.nullifier}</dd>
              </dl>

              <div className="mt-2">
                {candidate.sourceIndex === null ? (
                  <Chip>No configured source uses domain “{candidate.parsed.domainName}”</Chip>
                ) : candidate.checked?.ok ? (
                  <div className="font-bold text-system-green" data-testid="proof-check-ok">
                    ✓ Passes all conditions for {m.sources[candidate.sourceIndex].name}
                  </div>
                ) : (
                  <div className="font-bold text-system-red" data-testid="proof-check-fail">
                    ✗ Rejected: {candidate.checked?.reason}
                  </div>
                )}
              </div>

              <Button
                data-testid="submit-proof"
                className="mt-3 w-full"
                disabled={!candidate.checked?.ok || !!busy}
                isLoading={busy === "proof"}
                showChildrenWhenLoading
                onClick={submitProof}
              >
                {busy === "proof" ? "Submitting proof" : "Submit proof & settle"}
              </Button>
            </div>
          )}

          <div className="mt-4 border-t-2 border-surface-ink pt-3">
            {now > noResolvableAt ? (
              <Button
                data-testid="resolve-no"
                variant="destructive"
                className="w-full"
                disabled={!!busy}
                isLoading={busy === "no"}
                showChildrenWhenLoading
                onClick={resolveNo}
              >
                {busy === "no" ? "Resolving NO" : "Resolve NO (deadline passed)"}
              </Button>
            ) : (
              <p className="text-caption text-surface-grey-2">
                If the threshold isn't reached, anyone can resolve NO in {fmtDuration(noResolvableAt - now)} (deadline{" "}
                {fmtDate(m.deadline)} + {Number(m.resolutionBuffer) / 3600}h buffer).
              </p>
            )}
          </div>
        </>
      )}

      {settledNote && (
        <div className="mt-2 border-2 border-system-green bg-[#eaf7e4] px-2 py-1 text-sm font-bold text-system-green">
          {settledNote}
        </div>
      )}
      {txError && (
        <div className="mt-2 border-2 border-system-red bg-red-0 px-2 py-1 text-caption text-system-red">{txError}</div>
      )}
    </div>
  );
}

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
