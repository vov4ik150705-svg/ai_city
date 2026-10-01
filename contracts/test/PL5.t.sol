// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CorpToken} from "../src/CorpToken.sol";
import {Vault} from "../src/Vault.sol";
import {PackConstants} from "./PackConstants.sol";

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function expectRevert() external;
    function addr(uint256) external returns (address);
}

contract PL5Test {
    Vm internal constant vm = Vm(address(uint160(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D)));

    CorpToken internal corp;
    Vault internal vault;
    address internal playerA;
    address internal playerB;
    address internal house;

    function setUp() public {
        playerA = vm.addr(1);
        playerB = vm.addr(2);
        house = vm.addr(5);
        corp = new CorpToken(PackConstants.CREATOR_TAX_BPS, address(this), 1000);
        vault = new Vault(
            address(corp),
            address(this),
            address(this),
            vm.addr(3),
            vm.addr(4),
            PackConstants.CAPITAL_ANCHOR,
            PackConstants.VOUCHER_TTL_S,
            house
        );
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "eq");
    }

    function _deposit(address account, uint256 amount) internal {
        corp.transfer(account, amount);
        vm.startPrank(account);
        corp.approve(address(vault), amount);
        vault.deposit(account, amount);
        vm.stopPrank();
    }

    function test_mint_takes_only_its_corp() public {
        _deposit(playerA, 40);
        _deposit(playerA, 60);
        assertEq(vault.pending(playerA), 100);
        vault.mintCapital(playerA, 40, 40);
        assertEq(vault.pending(playerA), 60);
        assertEq(vault.backingOf(playerA), 40);
        assertEq(vault.capitalOf(playerA), 40);
        vault.mintCapital(playerA, 60, 60);
        assertEq(vault.pending(playerA), 0);
        assertEq(vault.backingOf(playerA), 100);
        assertEq(vault.capitalOf(playerA), 100);
    }

    function test_room_b_keeps_own_backing() public {
        _deposit(playerA, 100);
        _deposit(playerB, 50);
        vault.mintCapital(playerA, 100, 100);
        vault.mintCapital(playerB, 50, 50);
        vault.issueVoucher("a", playerA, 100, block.timestamp);
        assertEq(vault.voucherRoom(playerB), 50);
        vault.issueVoucher("b", playerB, 50, block.timestamp);
        assertEq(vault.backingOf(playerB), 50);
    }

    function test_pending_does_not_spend_house() public {
        _deposit(house, 50);
        vault.mintCapital(house, 50, 50);
        _deposit(playerA, 10);
        assertEq(vault.pending(playerA), 10);
        assertEq(vault.backingOf(playerA), 0);
        vm.expectRevert();
        vault.issueVoucher("pend", playerA, 1, block.timestamp);
        assertEq(vault.backingOf(house), 50);
    }

    function test_future_issued_at_reverts() public {
        _deposit(playerA, 10);
        vault.mintCapital(playerA, 10, 10);
        vm.expectRevert();
        vault.issueVoucher("future", playerA, 1, block.timestamp + 1);
        vm.warp(type(uint256).max - 10);
        vm.expectRevert();
        vault.issueVoucher("overflow", playerA, 1, block.timestamp);
        assertEq(vault.reservedOf(playerA), 0);
    }
}
