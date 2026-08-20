// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RegexLib} from "../src/lib/RegexLib.sol";

contract RegexLibHarness {
    function matchPattern(string memory pattern, string memory input) external pure returns (bool) {
        return RegexLib.matches(pattern, input);
    }

    function validatePattern(string memory pattern) external pure {
        RegexLib.validate(pattern);
    }
}

contract RegexLibTest is Test {
    RegexLibHarness h;

    function setUp() public {
        h = new RegexLibHarness();
    }

    function check(string memory pattern, string memory input, bool expected) internal view {
        bool got = h.matchPattern(pattern, input);
        assertEq(got, expected, string.concat("pattern=", pattern, " input=", input));
    }

    // --- literals & search semantics ---

    function test_Literals() public view {
        check("abc", "abc", true);
        check("abc", "xxabcxx", true); // search anywhere
        check("abc", "ab", false);
        check("abc", "acb", false);
        check("", "anything", true); // empty pattern matches everywhere
        check("a", "", false);
        check("", "", true);
    }

    // --- dot ---

    function test_Dot() public view {
        check("a.c", "abc", true);
        check("a.c", "a.c", true);
        check("a.c", "ac", false);
        check("a.c", "a\nc", false); // '.' excludes newline
        check("...", "ab", false);
        check("...", "abc", true);
    }

    // --- quantifiers ---

    function test_Star() public view {
        check("ab*c", "ac", true);
        check("ab*c", "abc", true);
        check("ab*c", "abbbbc", true);
        check("ab*c", "adc", false);
        check("a*", "", true);
    }

    function test_Plus() public view {
        check("ab+c", "ac", false);
        check("ab+c", "abc", true);
        check("ab+c", "abbbc", true);
    }

    function test_Question() public view {
        check("colou?r", "color", true);
        check("colou?r", "colour", true);
        check("colou?r", "colouur", false);
    }

    function test_Braces() public view {
        check("a{3}", "aa", false);
        check("a{3}", "aaa", true);
        check("a{2,3}b", "ab", false);
        check("a{2,3}b", "aab", true);
        check("a{2,3}b", "aaab", true);
        check("^a{2,3}b$", "aaaab", false);
        check("a{2,}", "aaaaaa", true);
        check("a{2,}$", "a", false);
        // invalid braces are literal (JS behaviour)
        check("a{x}", "a{x}", true);
        check("a{2", "a{2", true);
    }

    // --- classes ---

    function test_Classes() public view {
        check("[abc]", "b", true);
        check("[abc]", "d", false);
        check("[a-z]+", "hello", true);
        check("^[a-z]+$", "heLLo", false);
        check("[^a-z]", "abc", false);
        check("[^a-z]", "abc9", true);
        check("[0-9]{4}", "year 2026!", true);
        check("[]a]", "]", true); // ']' first in class is a literal
        check("[a-]", "-", true); // trailing '-' is a literal
        check("[-a]", "-", true);
    }

    function test_BuiltinClasses() public view {
        check("\\d+", "abc123", true);
        check("\\d+", "abcdef", false);
        check("^\\D+$", "abcdef", true);
        check("\\w+", "hello_world9", true);
        check("^\\W$", "%", true);
        check("^\\W$", "a", false);
        check("\\s", "a b", true);
        check("\\s", "ab", false);
        check("^\\S+$", "no-spaces", true);
        check("[\\d]+", "42", true);
        check("[\\w.-]+@[\\w.-]+", "nytdirect@nytimes.com", true);
    }

    // --- escapes ---

    function test_Escapes() public view {
        check("a\\.c", "a.c", true);
        check("a\\.c", "abc", false);
        check("\\$\\d+", "costs $50", true);
        check("a\\|b", "a|b", true);
        check("a\\|b", "a", false);
        check("\\(x\\)", "(x)", true);
        check("c:\\\\path", "c:\\path", true);
        check("a\\tb", "a\tb", true);
        check("line1\\nline2", "line1\nline2", true);
    }

    // --- groups & alternation ---

    function test_Alternation() public view {
        check("cat|dog", "hotdog stand", true);
        check("cat|dog", "catalog", true);
        check("cat|dog", "bird", false);
        check("^(cat|dog)$", "catalog", false);
        check("a|b|c", "zzcz", true);
    }

    function test_Groups() public view {
        check("(ab)+", "ababab", true);
        check("^(ab)+$", "ababa", false);
        check("(ab)*c", "c", true);
        check("a(b|c)d", "abd", true);
        check("a(b|c)d", "acd", true);
        check("a(b|c)d", "aed", false);
        check("(?:x|y)z", "yz", true);
        check("((a|b)c)+", "acbc", true);
        check("(a|)b", "b", true); // empty alternative
    }

    // --- anchors ---

    function test_Anchors() public view {
        check("^abc", "abcdef", true);
        check("^abc", "xabc", false);
        check("abc$", "xyzabc", true);
        check("abc$", "abcx", false);
        check("^abc$", "abc", true);
        check("^abc$", "aabc", false);
        check("^$", "", true);
        check("^$", "a", false);
    }

    // --- case-insensitive flag ---

    function test_CaseInsensitive() public view {
        check("(?i)breaking news", "BREAKING NEWS: something happened", true);
        check("(?i)breaking news", "Breaking News: something happened", true);
        check("breaking news", "Breaking News", false);
        check("(?i)[a-z]+", "HELLO", true);
        check("(?i)^ab$", "Ab", true);
        check("(?i)[^a-z]", "aA", false); // negated class must stay negated under ci
    }

    // --- realistic headline patterns ---

    function test_HeadlinePatterns() public view {
        string memory nyt =
            "Breaking News: New York City's coronavirus death toll soared past 10,000 after officials added more than 3,700 people presumed to have died of the virus.";
        check("^Breaking News:", nyt, true);
        check("(?i)death toll.*(10,000|ten thousand)", nyt, true);
        check("(?i)(coronavirus|covid)", nyt, true);
        check("(?i)fed (raises|cuts|holds) (interest )?rates", "Breaking News: Fed cuts rates by 25 basis points", true);
        check(
            "(?i)(bitcoin|btc).{0,40}\\$?1[0-9]{2},?[0-9]{3}",
            "Breaking News: Bitcoin surges past $150,000 for the first time",
            true
        );
        check("(?i)election.*(won|wins|victory)", "Breaking: Candidate X wins election in landslide", false);
        check("(?i)(won|wins|victory).*election|election.*(won|wins|victory)", "Candidate X wins election", true);
    }

    // --- from-address patterns ---

    function test_FromPatterns() public view {
        check("^nytdirect@nytimes\\.com$", "nytdirect@nytimes.com", true);
        check("^nytdirect@nytimes\\.com$", "nytdirect@nytimes.com.evil.com", false);
        check("@email\\.washingtonpost\\.com$", "no-reply@email.washingtonpost.com", true);
        check("@email\\.washingtonpost\\.com$", "no-reply@email-washingtonpost.com", false);
    }

    // --- pathological patterns terminate (NFA simulation, no backtracking blowup) ---

    function test_PathologicalTerminates() public view {
        // classic catastrophic backtracking killer: (a+)+b against aaaaaaaaaaaaaaaaaaaaaaaaaaaaX
        check("(a+)+b", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaX", false);
        check("(a|a)*$", "aaaaaaaaaaaaaaaaaaaaaaaaaaaab", true);
        check("(a*)*c", "aaaaaaaaaaaaaaaaaaaaaaaaaaaa", false);
    }

    // --- invalid patterns revert ---

    function test_InvalidPatterns() public {
        vm.expectRevert(bytes("Regex: quantifier without target"));
        h.validatePattern("*abc");
        vm.expectRevert(bytes("Regex: quantifier without target"));
        h.validatePattern("a**");
        vm.expectRevert(bytes("Regex: missing ')'"));
        h.validatePattern("(abc");
        vm.expectRevert(bytes("Regex: unbalanced ')'"));
        h.validatePattern("abc)");
        vm.expectRevert(bytes("Regex: unterminated class"));
        h.validatePattern("[abc");
        vm.expectRevert(bytes("Regex: trailing backslash"));
        h.validatePattern("abc\\");
        vm.expectRevert(bytes("Regex: unsupported group modifier"));
        h.validatePattern("(?=lookahead)");
        vm.expectRevert(bytes("Regex: bad {m,n} bounds"));
        h.validatePattern("a{3,2}");
        vm.expectRevert(bytes("Regex: bad class range"));
        h.validatePattern("[z-a]");
    }

    function test_ValidPatternsDoNotRevert() public view {
        h.validatePattern("");
        h.validatePattern("(?i)^Breaking News:.*$");
        h.validatePattern("a{2}{3}"); // quantified atom then literal braces… parses as {2} then literal {3}
        h.validatePattern("[\\]]"); // escaped ']' inside class
    }

    // --- regression: parser edges that once diverged from JS or bricked the matcher ---

    function test_RejectsDeeplyNestedGroups() public {
        // The matcher recurses ~4 EVM frames per group level; validate() must reject
        // anything test() couldn't execute (would StackOverflow around depth 45).
        string memory ok = nestGroups(16);
        h.validatePattern(ok); // depth 16 validates
        assertTrue(h.matchPattern(ok, "a")); // and runs
        vm.expectRevert(bytes("Regex: groups nested too deep"));
        h.validatePattern(nestGroups(17));
    }

    function test_RejectsUnsupportedEscapes() public {
        // These have meaning in JS we don't implement; accepting them as literals would
        // make a market's pattern mean different things in the JS preview vs onchain.
        vm.expectRevert(bytes("Regex: unsupported escape"));
        h.validatePattern("\\bword\\b"); // word boundary
        vm.expectRevert(bytes("Regex: unsupported escape"));
        h.validatePattern("(a)\\1"); // backreference
        vm.expectRevert(bytes("Regex: unsupported escape"));
        h.validatePattern("\\x41"); // hex escape
        vm.expectRevert(bytes("Regex: unsupported escape"));
        h.validatePattern("[a\\b]"); // unsupported escape inside a class
        // escaped metacharacters and control escapes stay valid
        h.validatePattern("a\\.b\\|c\\(d\\)");
        h.validatePattern("line\\nbreak\\ttab");
    }

    function test_RejectsQuantifiedAnchors() public {
        vm.expectRevert(bytes("Regex: nothing to repeat"));
        h.validatePattern("^*abc");
        vm.expectRevert(bytes("Regex: nothing to repeat"));
        h.validatePattern("abc$+");
        vm.expectRevert(bytes("Regex: nothing to repeat"));
        h.validatePattern("^{2}");
    }

    function test_ClassRangeWithClassEscapeEndpointIsLiteralDash() public view {
        // JS: [a-\d] == {a, '-', digit}. So '-' matches, and a range like 'b' does NOT.
        check("^[a-\\d]$", "-", true);
        check("^[a-\\d]$", "a", true);
        check("^[a-\\d]$", "5", true);
        check("^[a-\\d]$", "b", false); // not a range a-d
        check("^[a-\\d]$", "c", false);
    }

    function nestGroups(uint256 n) internal pure returns (string memory) {
        bytes memory open = new bytes(n);
        bytes memory close = new bytes(n);
        for (uint256 i = 0; i < n; i++) {
            open[i] = "(";
            close[i] = ")";
        }
        return string.concat(string(open), "a", string(close));
    }
}
