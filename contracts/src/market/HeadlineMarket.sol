// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RegexLib} from "../lib/RegexLib.sol";
import {ConditionalTokens} from "../tokens/ConditionalTokens.sol";
import {IERC20} from "../tokens/ERC20.sol";
import {CompiledEmailProof, EmailProof, IZKEmailVerifier, IZkRegexVerifier} from "../zkemail/IZKEmail.sol";

/// @title HeadlineMarket
/// @notice A binary prediction market on "will the news break?", settled permissionlessly
/// by zkEmail proofs of newspaper breaking-news alert emails.
///
/// The market creator configures:
///   - a set of newspaper sources (DKIM domain + regex over the From address),
///   - a regex over the email content (subject and/or body; per-source override allowed),
///   - a K-of-N threshold: how many distinct newspapers must have sent a matching
///     email for the market to resolve YES,
///   - an acceptance window [windowStart, deadline] for the email Date, and a
///     resolution buffer after the deadline during which proofs can still be
///     submitted before anyone may resolve NO.
///
/// The market itself is the oracle for its condition in ConditionalTokens: reaching
/// the threshold reports payouts [1,0] (YES); after deadline + buffer anyone can
/// report [0,1] (NO). Both paths are fully permissionless.
contract HeadlineMarket {
    using RegexLib for string;

    enum ContentField {
        Subject,
        Body,
        SubjectOrBody
    }

    enum Resolution {
        Unresolved,
        Yes,
        No
    }

    struct Source {
        string name; // display name, e.g. "The New York Times"
        string dkimDomain; // DKIM signing domain the proof must carry, e.g. "nytimes.com"
        string fromRegex; // regex the From address must match ("" = any)
        string contentRegex; // per-source override of the market content regex ("" = use default)
    }

    struct Evidence {
        uint32 sourceIndex;
        address submitter;
        uint64 emailTimestamp;
        bytes32 nullifier;
        string subject;
    }

    event ProofAccepted(
        uint256 indexed sourceIndex, address indexed submitter, string subject, uint256 emailTimestamp
    );
    /// @notice Emitted on the compiled (gas-real, private) path. Evidence lives in this
    /// event only — no subject exists to store, and storage writes are what the
    /// compiled path is shaving (backlog E1).
    event CompiledProofAccepted(
        uint256 indexed sourceIndex, address indexed submitter, bytes32 nullifier, uint256 emailTimestamp
    );
    event MarketResolved(Resolution resolution, address indexed resolver);

    // --- static configuration ---
    string public question;
    string public description; // human-readable resolution rules (Polymarket convention)
    string public contentRegex; // default content condition
    ContentField public contentField;
    Source[] internal _sources;
    uint8 public threshold;
    uint64 public windowStart;
    uint64 public deadline;
    uint64 public resolutionBuffer;
    address public creator;
    uint64 public createdAt;

    // Storage (not immutable): markets are EIP-1167 clones of one implementation, so
    // per-market values must live in each clone's own storage.
    ConditionalTokens public conditionalTokens;
    IZKEmailVerifier public verifier;
    IERC20 public collateralToken;
    bytes32 public questionId;
    bytes32 public conditionId;
    uint256 public yesPositionId;
    uint256 public noPositionId;
    bool private initialized;

    // --- settlement state ---
    Resolution public resolution;
    uint256 public matchedCount;
    mapping(uint256 => bool) public sourceMatched;
    mapping(bytes32 => bool) public nullifierUsed;
    Evidence[] internal _evidence;

    // --- compiled-circuit commitments (backlog E1/A3) ---
    // Per source: the pattern commitments a compiled proof must carry. Fixed at
    // creation so the compiled and interpreted paths enforce the same conditions.
    mapping(uint256 => bytes32) public sourceFromPatternHash; // keccak256(fromRegex)
    mapping(uint256 => bytes32) public sourceContentPatternHash; // keccak256(field ++ effective pattern)

    /// @notice Market configuration bundled in a struct (keeps initialize below the
    /// EVM stack limit and mirrors the factory's CreateMarketParams).
    struct InitConfig {
        string question;
        string description;
        string contentRegex;
        ContentField contentField;
        Source[] sources;
        uint8 threshold;
        uint64 windowStart;
        uint64 deadline;
        uint64 resolutionBuffer;
    }

    /// @dev Lock the shared implementation so only clones can be initialized.
    constructor() {
        initialized = true;
    }

    function initialize(
        ConditionalTokens _conditionalTokens,
        IZKEmailVerifier _verifier,
        IERC20 _collateralToken,
        address _creator,
        InitConfig calldata cfg
    ) external {
        require(!initialized, "Market: already initialized");
        initialized = true;
        require(cfg.sources.length > 0 && cfg.sources.length <= 32, "Market: 1-32 sources");
        require(cfg.threshold > 0 && cfg.threshold <= cfg.sources.length, "Market: bad threshold");
        require(cfg.deadline > block.timestamp, "Market: deadline in past");
        require(cfg.deadline > cfg.windowStart, "Market: deadline before window start");

        // Validate every regex now so malformed patterns can never brick settlement.
        if (bytes(cfg.contentRegex).length > 0) cfg.contentRegex.validate();
        for (uint256 i = 0; i < cfg.sources.length; i++) {
            require(bytes(cfg.sources[i].dkimDomain).length > 0, "Market: empty domain");
            // Sources must be distinct newspapers: a K-of-N threshold is meaningless if
            // one domain can occupy two slots and settle the market by itself.
            for (uint256 j = 0; j < i; j++) {
                require(
                    keccak256(bytes(cfg.sources[i].dkimDomain)) != keccak256(bytes(cfg.sources[j].dkimDomain)),
                    "Market: duplicate source domain"
                );
            }
            if (bytes(cfg.sources[i].fromRegex).length > 0) cfg.sources[i].fromRegex.validate();
            if (bytes(cfg.sources[i].contentRegex).length > 0) cfg.sources[i].contentRegex.validate();
            _sources.push(cfg.sources[i]);
            // Commitments for the compiled (circuit) settlement path: a compiled proof
            // must have been generated by the circuit for exactly these patterns.
            string memory effective =
                bytes(cfg.sources[i].contentRegex).length > 0 ? cfg.sources[i].contentRegex : cfg.contentRegex;
            sourceFromPatternHash[i] = keccak256(bytes(cfg.sources[i].fromRegex));
            sourceContentPatternHash[i] = keccak256(abi.encodePacked(uint8(cfg.contentField), effective));
        }
        require(
            bytes(cfg.contentRegex).length > 0 || allSourcesHaveOverrides(cfg.sources),
            "Market: no content condition"
        );

        question = cfg.question;
        description = cfg.description;
        contentRegex = cfg.contentRegex;
        contentField = cfg.contentField;
        threshold = cfg.threshold;
        windowStart = cfg.windowStart;
        deadline = cfg.deadline;
        resolutionBuffer = cfg.resolutionBuffer;
        creator = _creator;
        createdAt = uint64(block.timestamp);

        conditionalTokens = _conditionalTokens;
        verifier = _verifier;
        collateralToken = _collateralToken;

        // This market is its own oracle; the market address makes the question unique.
        questionId = keccak256(abi.encodePacked("HEADLINE_MARKET_V1", address(this)));
        _conditionalTokens.prepareCondition(address(this), questionId, 2);
        conditionId = _conditionalTokens.getConditionId(address(this), questionId, 2);
        yesPositionId =
            _conditionalTokens.getPositionId(_collateralToken, _conditionalTokens.getCollectionId(conditionId, 1));
        noPositionId =
            _conditionalTokens.getPositionId(_collateralToken, _conditionalTokens.getCollectionId(conditionId, 2));
    }

    // ------------------------------------------------------------------
    // Settlement — fully permissionless
    // ------------------------------------------------------------------

    /// @notice Submit a zkEmail proof of a newspaper alert email. Anyone may call.
    /// Accepting the `threshold`-th distinct source resolves the market YES.
    function submitProof(uint256 sourceIndex, EmailProof calldata proof) external {
        require(resolution == Resolution.Unresolved, "Market: already resolved");
        require(sourceIndex < _sources.length, "Market: bad source index");
        require(!sourceMatched[sourceIndex], "Market: source already matched");
        require(!nullifierUsed[proof.emailNullifier], "Market: email already used");
        require(verifier.verify(proof), "Market: invalid zkemail proof");

        Source storage src = _sources[sourceIndex];
        require(
            keccak256(bytes(proof.domainName)) == keccak256(bytes(src.dkimDomain)), "Market: wrong DKIM domain"
        );
        require(proof.timestamp >= windowStart, "Market: email before window");
        require(proof.timestamp <= deadline, "Market: email after deadline");
        if (bytes(src.fromRegex).length > 0) {
            require(src.fromRegex.matches(proof.fromAddress), "Market: from address mismatch");
        }
        require(contentMatches(src, proof), "Market: content regex mismatch");

        nullifierUsed[proof.emailNullifier] = true;
        sourceMatched[sourceIndex] = true;
        matchedCount++;
        _evidence.push(
            Evidence({
                sourceIndex: uint32(sourceIndex),
                submitter: msg.sender,
                emailTimestamp: uint64(proof.timestamp),
                nullifier: proof.emailNullifier,
                subject: proof.subject
            })
        );
        emit ProofAccepted(sourceIndex, msg.sender, proof.subject, proof.timestamp);

        if (matchedCount >= threshold) {
            resolution = Resolution.Yes;
            uint256[] memory payouts = new uint256[](2);
            payouts[0] = 1; // YES
            conditionalTokens.reportPayouts(questionId, payouts);
            emit MarketResolved(Resolution.Yes, msg.sender);
        }
    }

    /// @notice Gas-real settlement (backlog E1/A3): submit a COMPILED zk-regex proof.
    /// The From and content patterns were compiled into the proving circuit, which
    /// only produces a proof for a DKIM-signed email that matches them — so this
    /// path runs no regex onchain and reveals no email content. Anyone may call.
    function submitCompiledProof(uint256 sourceIndex, CompiledEmailProof calldata proof) external {
        require(resolution == Resolution.Unresolved, "Market: already resolved");
        require(sourceIndex < _sources.length, "Market: bad source index");
        require(!sourceMatched[sourceIndex], "Market: source already matched");
        require(!nullifierUsed[proof.emailNullifier], "Market: email already used");
        require(IZkRegexVerifier(address(verifier)).verifyCompiled(proof), "Market: invalid zkemail proof");
        require(
            keccak256(bytes(proof.domainName)) == keccak256(bytes(_sources[sourceIndex].dkimDomain)),
            "Market: wrong DKIM domain"
        );
        require(proof.timestamp >= windowStart, "Market: email before window");
        require(proof.timestamp <= deadline, "Market: email after deadline");
        require(proof.fromPatternHash == sourceFromPatternHash[sourceIndex], "Market: wrong from circuit");
        require(
            proof.contentPatternHash == sourceContentPatternHash[sourceIndex], "Market: wrong content circuit"
        );

        nullifierUsed[proof.emailNullifier] = true;
        sourceMatched[sourceIndex] = true;
        matchedCount++;
        emit CompiledProofAccepted(sourceIndex, msg.sender, proof.emailNullifier, proof.timestamp);

        if (matchedCount >= threshold) {
            resolution = Resolution.Yes;
            uint256[] memory payouts = new uint256[](2);
            payouts[0] = 1; // YES
            conditionalTokens.reportPayouts(questionId, payouts);
            emit MarketResolved(Resolution.Yes, msg.sender);
        }
    }

    /// @notice Dry-run of `submitCompiledProof` for frontends and settlement bots.
    function checkCompiledProof(uint256 sourceIndex, CompiledEmailProof calldata proof)
        external
        view
        returns (bool ok, string memory reason)
    {
        if (resolution != Resolution.Unresolved) return (false, "already resolved");
        if (sourceIndex >= _sources.length) return (false, "bad source index");
        if (sourceMatched[sourceIndex]) return (false, "source already matched");
        if (nullifierUsed[proof.emailNullifier]) return (false, "email already used");
        if (!IZkRegexVerifier(address(verifier)).verifyCompiled(proof)) return (false, "invalid zkemail proof");
        if (keccak256(bytes(proof.domainName)) != keccak256(bytes(_sources[sourceIndex].dkimDomain))) {
            return (false, "wrong DKIM domain");
        }
        if (proof.timestamp < windowStart) return (false, "email before window");
        if (proof.timestamp > deadline) return (false, "email after deadline");
        if (proof.fromPatternHash != sourceFromPatternHash[sourceIndex]) return (false, "wrong from circuit");
        if (proof.contentPatternHash != sourceContentPatternHash[sourceIndex]) {
            return (false, "wrong content circuit");
        }
        return (true, "");
    }

    /// @notice After the deadline plus the resolution buffer, anyone can resolve NO.
    function resolveNo() external {
        require(resolution == Resolution.Unresolved, "Market: already resolved");
        require(block.timestamp > uint256(deadline) + resolutionBuffer, "Market: too early to resolve NO");
        resolution = Resolution.No;
        uint256[] memory payouts = new uint256[](2);
        payouts[1] = 1; // NO
        conditionalTokens.reportPayouts(questionId, payouts);
        emit MarketResolved(Resolution.No, msg.sender);
    }

    /// @notice Dry-run a proof against a source's conditions without spending state.
    /// Lets frontends and settlement bots check acceptance before sending a tx.
    function checkProof(uint256 sourceIndex, EmailProof calldata proof)
        external
        view
        returns (bool ok, string memory reason)
    {
        if (resolution != Resolution.Unresolved) return (false, "already resolved");
        if (sourceIndex >= _sources.length) return (false, "bad source index");
        if (sourceMatched[sourceIndex]) return (false, "source already matched");
        if (nullifierUsed[proof.emailNullifier]) return (false, "email already used");
        if (!verifier.verify(proof)) return (false, "invalid zkemail proof");
        Source storage src = _sources[sourceIndex];
        if (keccak256(bytes(proof.domainName)) != keccak256(bytes(src.dkimDomain))) {
            return (false, "wrong DKIM domain");
        }
        if (proof.timestamp < windowStart) return (false, "email before window");
        if (proof.timestamp > deadline) return (false, "email after deadline");
        if (bytes(src.fromRegex).length > 0 && !src.fromRegex.matches(proof.fromAddress)) {
            return (false, "from address mismatch");
        }
        if (!contentMatches(src, proof)) return (false, "content regex mismatch");
        return (true, "");
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getSources() external view returns (Source[] memory) {
        return _sources;
    }

    function getEvidence() external view returns (Evidence[] memory) {
        return _evidence;
    }

    function sourceCount() external view returns (uint256) {
        return _sources.length;
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    function contentMatches(Source storage src, EmailProof calldata proof) internal view returns (bool) {
        string memory pattern = bytes(src.contentRegex).length > 0 ? src.contentRegex : contentRegex;
        if (bytes(pattern).length == 0) return true; // no content condition configured
        if (contentField == ContentField.Subject) return pattern.matches(proof.subject);
        if (contentField == ContentField.Body) return pattern.matches(proof.bodyExcerpt);
        return pattern.matches(proof.subject) || pattern.matches(proof.bodyExcerpt);
    }

    function allSourcesHaveOverrides(Source[] memory sources_) private pure returns (bool) {
        for (uint256 i = 0; i < sources_.length; i++) {
            if (bytes(sources_[i].contentRegex).length == 0) return false;
        }
        return true;
    }
}
