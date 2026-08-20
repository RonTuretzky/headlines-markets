// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConditionalTokens} from "../tokens/ConditionalTokens.sol";
import {IERC20} from "../tokens/ERC20.sol";
import {IZKEmailVerifier} from "../zkemail/IZKEmail.sol";
import {HeadlineMarket} from "./HeadlineMarket.sol";
import {FPMM} from "./FPMM.sol";
import {Clones} from "../utils/Clones.sol";

/// @title MarketFactory
/// @notice Permissionless factory: anyone can open a headline market. Deploys the
/// market (which registers itself as oracle of a fresh CTF condition) plus its FPMM
/// trading pool, and optionally seeds initial liquidity from the creator in the same
/// transaction. Collateral token and trading fee are configurable per market.
contract MarketFactory {
    struct CreateMarketParams {
        // market question
        string question;
        string description; // human-readable resolution rules
        // settlement conditions
        string contentRegex;
        HeadlineMarket.ContentField contentField;
        HeadlineMarket.Source[] sources;
        uint8 threshold; // K of N sources required for YES
        uint64 windowStart; // earliest accepted email Date (0 = any)
        uint64 deadline; // latest accepted email Date
        uint64 resolutionBuffer; // grace period after deadline before NO is resolvable
        // market token management
        IERC20 collateralToken;
        uint256 fee; // FPMM trading fee, 1e18-scale
        uint256 initialLiquidity; // pulled from creator if > 0
        uint256[] distributionHint; // optional initial odds, e.g. [3, 1]
    }

    struct MarketRecord {
        address market;
        address fpmm;
    }

    event MarketCreated(
        uint256 indexed marketId,
        address indexed market,
        address indexed fpmm,
        address creator,
        string question,
        address collateralToken,
        uint64 deadline
    );

    ConditionalTokens public immutable conditionalTokens;
    IZKEmailVerifier public immutable verifier;
    /// EIP-1167 implementations: every market/FPMM is a 45-byte clone of these.
    address public immutable marketImplementation;
    address public immutable fpmmImplementation;

    MarketRecord[] internal _markets;

    constructor(
        ConditionalTokens _conditionalTokens,
        IZKEmailVerifier _verifier,
        address _marketImplementation,
        address _fpmmImplementation
    ) {
        conditionalTokens = _conditionalTokens;
        verifier = _verifier;
        marketImplementation = _marketImplementation;
        fpmmImplementation = _fpmmImplementation;
    }

    function createMarket(CreateMarketParams calldata params)
        external
        returns (HeadlineMarket market, FPMM fpmm)
    {
        market = HeadlineMarket(Clones.clone(marketImplementation));
        market.initialize(
            conditionalTokens,
            verifier,
            params.collateralToken,
            msg.sender,
            HeadlineMarket.InitConfig({
                question: params.question,
                description: params.description,
                contentRegex: params.contentRegex,
                contentField: params.contentField,
                sources: params.sources,
                threshold: params.threshold,
                windowStart: params.windowStart,
                deadline: params.deadline,
                resolutionBuffer: params.resolutionBuffer
            })
        );
        fpmm = FPMM(Clones.clone(fpmmImplementation));
        fpmm.initialize(conditionalTokens, params.collateralToken, market.conditionId(), params.fee);

        if (params.initialLiquidity > 0) {
            require(
                params.collateralToken.transferFrom(msg.sender, address(this), params.initialLiquidity),
                "Factory: transfer failed"
            );
            params.collateralToken.approve(address(fpmm), params.initialLiquidity);
            fpmm.addFunding(params.initialLiquidity, params.distributionHint, msg.sender);
        }

        uint256 marketId = _markets.length;
        _markets.push(MarketRecord({market: address(market), fpmm: address(fpmm)}));
        emit MarketCreated(
            marketId,
            address(market),
            address(fpmm),
            msg.sender,
            params.question,
            address(params.collateralToken),
            params.deadline
        );
    }

    function marketCount() external view returns (uint256) {
        return _markets.length;
    }

    function getMarket(uint256 marketId) external view returns (MarketRecord memory) {
        return _markets[marketId];
    }

    function getAllMarkets() external view returns (MarketRecord[] memory) {
        return _markets;
    }
}
