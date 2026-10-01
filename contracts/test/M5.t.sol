// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CorpToken} from "../src/CorpToken.sol";
import {Vault} from "../src/Vault.sol";
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

contract M5Test {
    Vm internal constant vm = Vm(address(uint160(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D)));

    CorpToken internal corp;
    CorpToken internal nvda;
    Vault internal vault;
    PrizeTreasury internal prizes;
    address internal player;
    address internal bot;
    address internal guardian;
    address internal safetySigner;

    function setUp() public {
        player = vm.addr(1);
        bot = vm.addr(2);
        guardian = vm.addr(3);
        safetySigner = vm.addr(4);
        corp = new CorpToken(PackConstants.CREATOR_TAX_BPS, address(this), 1000);
        nvda = new CorpToken(0, address(this), 0);
        vault = new Vault(
            address(corp),
            address(this),
            address(this),
            guardian,
            safetySigner,
            PackConstants.CAPITAL_ANCHOR,
            PackConstants.VOUCHER_TTL_S,
            address(0)
        );
        address[] memory stocks = new address[](6);
        stocks[0] = address(nvda);
        stocks[1] = address(uint160(0x101));
        stocks[2] = address(uint160(0x102));
        stocks[3] = address(uint160(0x103));
        stocks[4] = address(uint160(0x104));
        stocks[5] = address(uint160(0x105));
        prizes = new PrizeTreasury(bot, guardian, safetySigner, stocks);
        corp.transfer(player, 100);
        corp.transfer(bot, 40);
        nvda.mint(bot, 1000);
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "eq");
    }

    function test_refund_capped_by_backing() public {
        vm.startPrank(player);
        corp.approve(address(vault), 100);
        vault.deposit(player, 100);
        vm.stopPrank();
        vault.mintCapital(player, 100, 100);
        vm.prank(safetySigner);
        vm.expectRevert();
        vault.refundPlayer(player, 101);
        vm.prank(safetySigner);
        vault.refundPlayer(player, 100);
        assertEq(vault.backingOf(player), 0);
        assertEq(vault.capitalOf(player), 0);
        assertEq(corp.balanceOf(player), 100);
    }

    function test_return_unsettled_skips_owed() public {
        vm.startPrank(bot);
        nvda.approve(address(prizes), 1000);
        prizes.deposit(address(nvda), 0, 1000);
        vm.stopPrank();
        address[] memory players = new address[](1);
        players[0] = player;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 700;
        vm.prank(safetySigner);
        prizes.slice(bytes32(uint256(1)), address(nvda), 0, players, amounts);
        vm.prank(bot);
        prizes.returnUnsettled(address(nvda), 0);
        assertEq(nvda.balanceOf(bot), 300);
        assertEq(prizes.owed(0, address(nvda), player), 700);
        vm.prank(player);
        prizes.claimPrize(address(nvda), 0);
        assertEq(nvda.balanceOf(player), 700);
        assertEq(prizes.owed(0, address(nvda), player), 0);
    }

    function test_issue_requires_available_backing() public {
        vm.startPrank(player);
        corp.approve(address(vault), 100);
        vault.deposit(player, 100);
        vm.stopPrank();
        vm.expectRevert();
        vault.issueVoucher("early", player, 1, block.timestamp);
        vault.mintCapital(player, 100, 100);
        vault.issueVoucher("ok", player, 100, block.timestamp);
        vm.expectRevert();
        vault.issueVoucher("over", player, 1, block.timestamp);
        address[] memory players = new address[](1);
        players[0] = player;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        vm.prank(safetySigner);
        vm.expectRevert();
        vault.batchRefundPlayers(players, amounts);
        vm.prank(guardian);
        vault.setRefundRoot(bytes32(uint256(1)));
        require(vault.refundRoot() == bytes32(uint256(1)), "root");
    }

    function test_recover_skips_corp_and_stock() public {
        vm.prank(guardian);
        vm.expectRevert();
        vault.recoverWrongToken(address(corp));
        vm.prank(guardian);
        vm.expectRevert();
        prizes.recoverWrongToken(address(nvda));
    }
}
