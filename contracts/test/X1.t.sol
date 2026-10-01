// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CorpToken} from "../src/CorpToken.sol";
import {PrizeTreasury} from "../src/PrizeTreasury.sol";
import {StakeRegistry} from "../src/StakeRegistry.sol";
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

contract X1Test {
    Vm internal constant vm = Vm(address(uint160(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D)));

    uint256 internal constant COOLDOWN = 100;

    CorpToken internal corp;
    CorpToken internal nvda;
    CorpToken internal tsla;
    Vault internal vault;
    PrizeTreasury internal prizes;
    StakeRegistry internal stakes;
    address internal player;
    address internal other;
    address internal bot;

    function setUp() public {
        player = vm.addr(1);
        other = vm.addr(2);
        bot = vm.addr(3);
        corp = new CorpToken(PackConstants.CREATOR_TAX_BPS, address(this), 1000);
        nvda = new CorpToken(0, address(this), 0);
        tsla = new CorpToken(0, address(this), 0);
        vault = new Vault(
            address(corp),
            address(this),
            address(this),
            vm.addr(4),
            vm.addr(5),
            PackConstants.CAPITAL_ANCHOR,
            PackConstants.VOUCHER_TTL_S,
            address(0)
        );
        address[] memory stocks = new address[](6);
        stocks[0] = address(nvda);
        stocks[1] = address(tsla);
        stocks[2] = address(uint160(0x102));
        stocks[3] = address(uint160(0x103));
        stocks[4] = address(uint160(0x104));
        stocks[5] = address(uint160(0x105));
        prizes = new PrizeTreasury(bot, vm.addr(4), address(this), stocks);
        stakes = new StakeRegistry(address(this), COOLDOWN);
        stakes.setToken("NVDA", address(nvda));
        stakes.setToken("TSLA", address(tsla));
        corp.transfer(player, 400);
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "eq");
    }

    function _stake(address who, string memory ticker, uint256 amount) internal {
        CorpToken token = _token(ticker);
        token.mint(who, amount);
        vm.startPrank(who);
        token.approve(address(stakes), amount);
        stakes.stake(who, ticker, amount);
        vm.stopPrank();
    }

    function _token(string memory ticker) internal view returns (CorpToken) {
        if (keccak256(bytes(ticker)) == keccak256(bytes("TSLA"))) return tsla;
        return nvda;
    }

    function _key(string memory ticker) internal pure returns (bytes32) {
        return keccak256(bytes(ticker));
    }

    function test_cooldown_zero_reverts() public {
        vm.expectRevert();
        new StakeRegistry(address(this), 0);
    }

    function test_claim_one_second_before_and_at_ready() public {
        _stake(player, "NVDA", 100);
        vm.prank(player);
        stakes.requestUnstake("NVDA", 40);
        (, uint256 ready) = stakes.coolingOf(player, _key("NVDA"));
        assertEq(ready, block.timestamp + COOLDOWN);
        vm.warp(ready - 1);
        vm.prank(player);
        vm.expectRevert();
        stakes.claimUnstaked("NVDA");
        assertEq(nvda.balanceOf(player), 0);
        vm.warp(ready);
        vm.prank(player);
        stakes.claimUnstaked("NVDA");
        assertEq(nvda.balanceOf(player), 40);
        (uint256 left,) = stakes.coolingOf(player, _key("NVDA"));
        assertEq(left, 0);
        vm.prank(player);
        vm.expectRevert();
        stakes.claimUnstaked("NVDA");
    }

    function test_request_zero_and_over_stake_revert() public {
        _stake(player, "NVDA", 100);
        vm.prank(player);
        vm.expectRevert();
        stakes.requestUnstake("NVDA", 0);
        vm.prank(player);
        vm.expectRevert();
        stakes.requestUnstake("NVDA", 101);
        assertEq(stakes.amountOf(player, _key("NVDA")), 100);
        (uint256 cooling,) = stakes.coolingOf(player, _key("NVDA"));
        assertEq(cooling, 0);
    }

    function test_snapshot_omits_bucket_and_sorts_with_ready() public {
        _stake(player, "TSLA", 70);
        _stake(player, "NVDA", 100);
        vm.prank(player);
        stakes.requestUnstake("TSLA", 20);
        (, uint256 tslaReady) = stakes.coolingOf(player, _key("TSLA"));
        vm.warp(block.timestamp + 5);
        vm.prank(player);
        stakes.requestUnstake("NVDA", 40);
        (, uint256 nvdaReady) = stakes.coolingOf(player, _key("NVDA"));
        require(nvdaReady != tslaReady, "ready");
        (string[] memory active, uint256[] memory activeAmt) = stakes.snapshot(player);
        require(active.length == 2, "rows");
        require(keccak256(bytes(active[0])) == _key("NVDA"), "nvda");
        require(keccak256(bytes(active[1])) == _key("TSLA"), "tsla");
        assertEq(activeAmt[0], 60);
        assertEq(activeAmt[1], 50);
        (string[] memory coolingTickers, uint256[] memory coolingAmt, uint256[] memory readyAt) =
            stakes.coolingSnapshot(player);
        require(coolingTickers.length == 2, "cool");
        require(keccak256(bytes(coolingTickers[0])) == _key("NVDA"), "cnvda");
        require(keccak256(bytes(coolingTickers[1])) == _key("TSLA"), "ctsla");
        assertEq(coolingAmt[0], 40);
        assertEq(coolingAmt[1], 20);
        assertEq(readyAt[0], nvdaReady);
        assertEq(readyAt[1], tslaReady);
    }

    function test_matured_bucket_paid_inside_new_request() public {
        _stake(player, "NVDA", 100);
        vm.prank(player);
        stakes.requestUnstake("NVDA", 40);
        (, uint256 ready) = stakes.coolingOf(player, _key("NVDA"));
        vm.warp(ready);
        uint256 before = nvda.balanceOf(player);
        vm.prank(player);
        stakes.requestUnstake("NVDA", 10);
        assertEq(nvda.balanceOf(player), before + 40);
        (uint256 cooling, uint256 nextReady) = stakes.coolingOf(player, _key("NVDA"));
        assertEq(cooling, 10);
        assertEq(nextReady, block.timestamp + COOLDOWN);
        require(nextReady != ready, "restart");
        assertEq(stakes.amountOf(player, _key("NVDA")), 50);
    }

    function test_immature_bucket_sums_and_restarts() public {
        _stake(player, "NVDA", 100);
        vm.prank(player);
        stakes.requestUnstake("NVDA", 40);
        (, uint256 ready) = stakes.coolingOf(player, _key("NVDA"));
        vm.warp(ready - 1);
        uint256 before = nvda.balanceOf(player);
        vm.prank(player);
        stakes.requestUnstake("NVDA", 10);
        assertEq(nvda.balanceOf(player), before);
        (uint256 cooling, uint256 nextReady) = stakes.coolingOf(player, _key("NVDA"));
        assertEq(cooling, 50);
        assertEq(nextReady, block.timestamp + COOLDOWN);
        require(nextReady > ready, "later");
        vm.prank(player);
        vm.expectRevert();
        stakes.claimUnstaked("NVDA");
    }

    function test_same_block_restake_pays_nothing() public {
        nvda.mint(player, 200);
        vm.startPrank(player);
        nvda.approve(address(stakes), 200);
        stakes.stake(player, "NVDA", 100);
        uint256 afterStake = nvda.balanceOf(player);
        stakes.requestUnstake("NVDA", 40);
        stakes.stake(player, "NVDA", 50);
        stakes.requestUnstake("NVDA", 50);
        assertEq(nvda.balanceOf(player), afterStake - 50);
        vm.expectRevert();
        stakes.claimUnstaked("NVDA");
        vm.stopPrank();
        (uint256 cooling,) = stakes.coolingOf(player, _key("NVDA"));
        assertEq(cooling, 90);
        assertEq(stakes.amountOf(player, _key("NVDA")), 60);
        assertEq(nvda.balanceOf(other), 0);
    }

    function test_bucket_cannot_move_to_a_third_party() public {
        _stake(player, "NVDA", 100);
        vm.prank(player);
        stakes.requestUnstake("NVDA", 40);
        vm.prank(other);
        vm.expectRevert();
        stakes.claimUnstaked("NVDA");
        bytes memory payload = abi.encodeWithSignature("transferCooling(address,string,uint256)", other, "NVDA", uint256(40));
        (bool ok,) = address(stakes).call(payload);
        require(!ok, "transfer");
        (uint256 cooling,) = stakes.coolingOf(player, _key("NVDA"));
        assertEq(cooling, 40);
        assertEq(nvda.balanceOf(other), 0);
        assertEq(nvda.balanceOf(player), 0);
    }

    function test_old_unstake_selector_reverts() public {
        _stake(player, "NVDA", 100);
        vm.prank(player);
        (bool ok,) = address(stakes).call(abi.encodeWithSignature("unstake(string,uint256)", "NVDA", uint256(1)));
        require(!ok, "selector");
        assertEq(stakes.amountOf(player, _key("NVDA")), 100);
        assertEq(nvda.balanceOf(player), 0);
    }

    function test_voucher_outcome_present_and_release() public {
        vm.startPrank(player);
        corp.approve(address(vault), 200);
        vault.deposit(player, 200);
        vm.stopPrank();
        vault.mintCapital(player, 200, 200);
        uint256 t0 = block.timestamp;
        vault.issueVoucher("shown", player, 50, t0);
        vault.presentVoucher("shown", player, 50, t0);
        assertEq(uint256(vault.outcomeOf("shown")), uint256(vault.OUTCOME_PRESENTED()));
        vm.expectRevert();
        vault.presentVoucher("shown", player, 50, t0);
        vm.expectRevert();
        vault.releaseExpiredVoucher("shown");
        assertEq(uint256(vault.outcomeOf("shown")), 1);
        vault.issueVoucher("late", player, 50, t0);
        vm.warp(t0 + PackConstants.VOUCHER_TTL_S + 1);
        vm.expectRevert();
        vault.presentVoucher("late", player, 50, t0);
        assertEq(uint256(vault.outcomeOf("late")), 0);
        vault.releaseExpiredVoucher("late");
        assertEq(uint256(vault.outcomeOf("late")), uint256(vault.OUTCOME_RELEASED()));
        vm.expectRevert();
        vault.presentVoucher("late", player, 50, t0);
        assertEq(uint256(vault.outcomeOf("late")), 2);
    }

    function test_repeat_slice_same_batch_reverts() public {
        nvda.mint(bot, 100);
        vm.startPrank(bot);
        nvda.approve(address(prizes), 100);
        prizes.deposit(address(nvda), 0, 100);
        vm.stopPrank();
        address[] memory players = new address[](1);
        players[0] = player;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 40;
        bytes32 batch = keccak256("x1-batch");
        prizes.slice(batch, address(nvda), 0, players, amounts);
        assertEq(prizes.owed(0, address(nvda), player), 40);
        assertEq(prizes.unsliced(0, address(nvda)), 60);
        bytes memory payload = abi.encodeWithSignature(
            "slice(bytes32,address,uint8,address[],uint256[])",
            batch,
            address(nvda),
            uint8(0),
            players,
            amounts
        );
        (bool ok, bytes memory ret) = address(prizes).call(payload);
        require(!ok, "replayed");
        require(keccak256(ret) == keccak256(abi.encodeWithSignature("Error(string)", "batch")), "reason");
        assertEq(prizes.owed(0, address(nvda), player), 40);
        bytes32 next = keccak256("x1-batch-2");
        amounts[0] = 60;
        prizes.slice(next, address(nvda), 0, players, amounts);
        assertEq(prizes.owed(0, address(nvda), player), 100);
        assertEq(prizes.unsliced(0, address(nvda)), 0);
    }
}
