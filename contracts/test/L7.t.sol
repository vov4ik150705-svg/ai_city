// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CorpToken} from "../src/CorpToken.sol";
import {Vault} from "../src/Vault.sol";
import {StakeRegistry} from "../src/StakeRegistry.sol";
import {MerkleRoots} from "../src/MerkleRoots.sol";
import {PrizeTreasury} from "../src/PrizeTreasury.sol";
import {PackConstants} from "./PackConstants.sol";

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function expectRevert() external;
    function addr(uint256) external returns (address);
}

contract L7Test {
    Vm internal constant vm = Vm(address(uint160(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D)));

    uint256 internal constant OVER_253 = (uint256(1) << 53) + 1;

    CorpToken internal corp;
    Vault internal vault;
    StakeRegistry internal stakes;
    MerkleRoots internal roots;
    PrizeTreasury internal prizes;
    address internal playerA;
    address internal playerB;
    address internal guardian;
    address internal safetySigner;

    function setUp() public {
        playerA = vm.addr(1);
        playerB = vm.addr(2);
        guardian = vm.addr(3);
        safetySigner = vm.addr(4);
        corp = new CorpToken(PackConstants.CREATOR_TAX_BPS, address(this), OVER_253 + 1000);
        vault = new Vault(
            address(corp),
            address(this),
            address(this),
            guardian,
            safetySigner,
            PackConstants.CAPITAL_ANCHOR,
            PackConstants.VOUCHER_TTL_S
        );
        address[] memory stocks = new address[](6);
        uint256 i;
        while (i < 6) {
            stocks[i] = address(uint160(0x100 + i));
            i += 1;
        }
        prizes = new PrizeTreasury(address(this), guardian, safetySigner, stocks);
        stakes = new StakeRegistry(address(this));
        roots = new MerkleRoots(address(this));
        corp.transfer(playerA, OVER_253);
        corp.transfer(playerB, 1);
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "eq");
    }

    function test_vault_deposit_then_mint() public {
        vm.expectRevert();
        vault.mintCapital(playerA, 1);

        vm.startPrank(playerA);
        corp.approve(address(vault), 1);
        vault.deposit(playerA, 1);
        vm.stopPrank();

        vm.expectRevert();
        vault.mintCapital(playerA, PackConstants.CAPITAL_ANCHOR + 1);

        vault.mintCapital(playerA, 1);
        assertEq(vault.capitalOf(playerA), 1);
        assertEq(vault.pending(playerA), 0);
        assertEq(vault.vaultCorp(), 1);

        vm.expectRevert();
        vault.mintCapital(playerA, 1);
    }

    function test_c10_fixture_parity() public {
        vm.prank(playerA);
        corp.transfer(playerB, OVER_253);
        assertEq(corp.balanceOf(playerB), OVER_253 + 1);

        vm.expectRevert();
        vault.mintCapital(playerA, 1);

        vm.startPrank(playerB);
        corp.approve(address(vault), 1);
        vault.deposit(playerB, 1);
        vm.stopPrank();
        assertEq(vault.vaultCorp(), 1);
        vault.mintCapital(playerB, 1);
        assertEq(vault.capitalOf(playerB), 1);

        uint256 issuedAt = block.timestamp;
        vault.issueVoucher("n1", playerB, 1, issuedAt);
        vault.presentVoucher("n1", playerB, 1, issuedAt);
        vm.expectRevert();
        vault.presentVoucher("n1", playerB, 1, issuedAt);

        CorpToken nvda = new CorpToken(0, address(this), 0);
        nvda.mint(playerA, OVER_253);
        stakes.setToken("NVDA", address(nvda));
        vm.startPrank(playerA);
        nvda.approve(address(stakes), OVER_253);
        stakes.stake(playerA, "NVDA", OVER_253);
        vm.stopPrank();
        (string[] memory tickers, uint256[] memory amounts) = stakes.snapshot(playerA);
        require(tickers.length == 1, "rows");
        require(keccak256(bytes(tickers[0])) == keccak256(bytes("NVDA")), "ticker");
        assertEq(amounts[0], OVER_253);

        bytes32 root = keccak256("one-leaf");
        roots.putRoot("c", 0, root);
        require(roots.getRoot("c", 0) == root, "root");
    }

    function test_creator_tax_untaxed_transfer() public {
        require(corp.creatorTaxBps() == PackConstants.CREATOR_TAX_BPS, "tax");
        uint256 beforeB = corp.balanceOf(playerB);
        vm.prank(playerA);
        corp.transfer(playerB, 100);
        assertEq(corp.balanceOf(playerB), beforeB + 100);
        assertEq(corp.balanceOf(playerA), OVER_253 - 100);
    }

    function test_voucher_expired() public {
        vm.startPrank(playerB);
        corp.approve(address(vault), 1);
        vault.deposit(playerB, 1);
        vm.stopPrank();
        vault.mintCapital(playerB, 1);
        uint256 issuedAt = block.timestamp;
        vault.issueVoucher("n3", playerB, 1, issuedAt);
        vm.warp(issuedAt + PackConstants.VOUCHER_TTL_S + 1);
        vm.expectRevert();
        vault.presentVoucher("n3", playerB, 1, issuedAt);
    }
}
