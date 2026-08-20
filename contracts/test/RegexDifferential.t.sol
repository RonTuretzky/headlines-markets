// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RegexLib} from "../src/lib/RegexLib.sol";

/// @notice Differential test: RegexLib vs JavaScript's RegExp (via `node`, ffi).
/// Every (pattern, input) pair in the corpus must agree with JS semantics. The
/// corpus stays inside the documented JS-compatible subset (ASCII, no lookaround,
/// no leading-']' classes).
contract RegexDifferentialTest is Test {
    string[] patterns;
    string[] inputs;

    function setUp() public {
        patterns = [
            "abc",
            "^abc$",
            "a.c",
            "ab*c",
            "ab+c",
            "colou?r",
            "a{2,3}b",
            "a{3}",
            "a{2,}",
            "[a-z]+",
            "^[a-z]+$",
            "[^a-z]+",
            "[0-9]{4}",
            "\\d+",
            "^\\D+$",
            "\\w+@\\w+",
            "[\\w.-]+@[\\w.-]+",
            "\\s\\S",
            "cat|dog",
            "^(cat|dog)$",
            "(ab)+",
            "^(ab)+$",
            "a(b|c)d",
            "((a|b)c)+",
            "(a|)b",
            "(?:x|y)z",
            "a\\.c",
            "\\$\\d+",
            "(a+)+b",
            "(a*)*c",
            "(?i)breaking news",
            "(?i)^fed (cuts|raises) rates",
            "(?i)[a-f0-9]+z",
            "(?i)[^a-z]",
            "Breaking News:.*\\d{2,}",
            "a{x}",
            "^$",
            ""
        ];
        inputs = [
            "",
            "a",
            "b",
            "abc",
            "xxabcxx",
            "acb",
            "aabbb",
            "aaab",
            "ab",
            "ababab",
            "ababa",
            "color",
            "colour",
            "colouur",
            "hello world",
            "HELLO",
            "heLLo42",
            "2026",
            "no digits here",
            "1234567890",
            "nytdirect@nytimes.com",
            "no-reply@email.washingtonpost.com",
            "cat",
            "catalog",
            "hotdog",
            "abd",
            "acd",
            "aed",
            "acbc",
            "xz",
            "yz",
            "a.c",
            "costs $50 today",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaX",
            "aaaaaaaaaaaaaaaaaaaaaaaaaab",
            "Breaking News: Fed cuts rates by 25 basis points",
            "BREAKING NEWS: something happened",
            "Fed Cuts Rates in emergency session",
            "fed raises rates again",
            "a{x}",
            "deadbeefz",
            "DEADBEEFZ"
        ];
    }

    function test_DifferentialAgainstJS() public {
        // One external self-call per pattern: fresh EVM memory each frame. A single
        // frame doing ~1600 matcher runs (or the quadratic string.concat of one giant
        // JSON corpus) blows past the memory expansion curve.
        for (uint256 p = 0; p < patterns.length; p++) {
            this.checkPatternAgainstInputs(patterns[p]);
        }
    }

    function checkPatternAgainstInputs(string calldata pattern) external {
        string memory json = "[";
        for (uint256 i = 0; i < inputs.length; i++) {
            if (i > 0) json = string.concat(json, ",");
            json = string.concat(json, "[", quote(pattern), ",", quote(inputs[i]), "]");
        }
        json = string.concat(json, "]");
        bytes memory jsResults = runOracle(json);
        assertEq(jsResults.length, inputs.length, "oracle result length");

        for (uint256 i = 0; i < inputs.length; i++) {
            bool ours = RegexLib.matches(pattern, inputs[i]);
            bool theirs = jsResults[i] == 0x01;
            assertEq(ours, theirs, string.concat("mismatch: pattern=<", pattern, "> input=<", inputs[i], ">"));
        }
    }

    /// forge-config: default.fuzz.runs = 40
    function testFuzz_DifferentialRandomInputs(bytes memory raw) public {
        // Constrain to printable ASCII so JS string semantics match byte semantics.
        bytes memory buf = new bytes(raw.length > 64 ? 64 : raw.length);
        for (uint256 i = 0; i < buf.length; i++) {
            buf[i] = bytes1(0x20 + (uint8(raw[i]) % 0x5F)); // 0x20..0x7E
        }
        string memory input = string(buf);

        string[8] memory pats = [
            "[a-z]+[0-9]",
            "\\w+\\s\\w+",
            "(?i)[a-f]{2,4}",
            "^[ -~]*$",
            "a.*z",
            "([A-Z]|[0-9])+",
            "\\d{2},?\\d{3}",
            "x?y?z?[^w]"
        ];

        string memory json = "[";
        for (uint256 p = 0; p < pats.length; p++) {
            if (p > 0) json = string.concat(json, ",");
            json = string.concat(json, "[", quote(pats[p]), ",", quote(input), "]");
        }
        json = string.concat(json, "]");
        bytes memory jsResults = runOracle(json);

        for (uint256 p = 0; p < pats.length; p++) {
            bool ours = RegexLib.matches(pats[p], input);
            bool theirs = jsResults[p] == 0x01;
            assertEq(ours, theirs, string.concat("fuzz mismatch: pattern=<", pats[p], "> input=<", input, ">"));
        }
    }

    // ------------------------------------------------------------------

    function runOracle(string memory casesJson) internal returns (bytes memory) {
        string[] memory cmd = new string[](3);
        cmd[0] = "node";
        cmd[1] = "test/differential/regex-oracle.mjs";
        cmd[2] = base64(bytes(casesJson));
        return vm.ffi(cmd); // ffi hex-decodes 0x-prefixed stdout
    }

    /// @dev JSON string literal with escaping for backslash, quote and control chars.
    function quote(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(b.length * 6 + 2);
        uint256 o = 0;
        out[o++] = '"';
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c == '"' || c == "\\") {
                out[o++] = "\\";
                out[o++] = c;
            } else if (uint8(c) < 0x20) {
                out[o++] = "\\";
                out[o++] = "u";
                out[o++] = "0";
                out[o++] = "0";
                out[o++] = hexChar(uint8(c) >> 4);
                out[o++] = hexChar(uint8(c) & 0x0F);
            } else {
                out[o++] = c;
            }
        }
        out[o++] = '"';
        assembly {
            mstore(out, o)
        }
        return string(out);
    }

    function hexChar(uint8 v) private pure returns (bytes1) {
        return v < 10 ? bytes1(v + 48) : bytes1(v + 87);
    }

    bytes internal constant B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function base64(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        string memory result = new string(4 * ((data.length + 2) / 3));
        bytes memory table = B64;
        assembly {
            let tablePtr := add(table, 1)
            let resultPtr := add(result, 32)
            let dataPtr := data
            let endPtr := add(data, mload(data))
            for {} lt(dataPtr, endPtr) {} {
                dataPtr := add(dataPtr, 3)
                let input := mload(dataPtr)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))
                resultPtr := add(resultPtr, 1)
            }
            switch mod(mload(data), 3)
            case 1 {
                mstore8(sub(resultPtr, 1), 0x3d)
                mstore8(sub(resultPtr, 2), 0x3d)
            }
            case 2 { mstore8(sub(resultPtr, 1), 0x3d) }
        }
        return result;
    }
}
